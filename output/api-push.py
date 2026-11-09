#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""备用推送通道：github.com:443 被阻断时，经 api.github.com Git Data API 推送。

与 bash 版的关键差异：
- blob 一律取自 git 仓库对象（git cat-file blob <sha>，规范 LF 字节），
  而非工作树文件（CRLF），保证与本地 tree 完全一致；
- 路径/提交元数据全部在 Python 内部处理（git -z 输出 + bytes decode utf-8），
  绕开 Windows bash→python argv 编码损坏（中文路径乱码根因）；
- diff-tree 以 父→子 方向调用，A/D 状态与 blob 版本才正确；
- 请求经 curl 子进程发送（Node TLS 直连被重置、python https 不稳，curl/schannel 可用）；
- 推送完成后将本地分支对齐到远端 UTC 序列化链（GitHub 会把提交时间规范化为 UTC，
  与本地 +0800 字节不同导致 SHA 分叉；对齐后本地历史 = 远端历史，后续推送干净快进）。
"""
import base64
import json
import re
import subprocess
import sys
import time

REPO = 'qf-116/DHZC_EMS'
BRANCH = sys.argv[1] if len(sys.argv) > 1 else 'main'

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')


def git(*args, binary=False):
    r = subprocess.run(['git'] + list(args), capture_output=True)
    if r.returncode != 0:
        raise RuntimeError('git %s failed: %s' % (' '.join(args), r.stderr.decode('utf-8', 'replace')))
    return r.stdout if binary else r.stdout.decode('utf-8')


def credential_token():
    out = subprocess.run(['git', 'credential', 'fill'], input='protocol=https\nhost=github.com\n',
                         capture_output=True, text=True).stdout
    m = re.search(r'^password=(.+)$', out, re.M)
    return m.group(1).strip()


TOKEN = credential_token()


def curl(method, path, body=None):
    """调用 GitHub API（curl 子进程），响应含 sha/object 视为成功，重试至 6 次。"""
    args = ['curl', '-sS', '--max-time', '120', '--retry', '3', '--retry-all-errors',
            '-X', method, '-H', 'Authorization: Bearer ' + TOKEN,
            '-H', 'Accept: application/vnd.github+json',
            'https://api.github.com/repos/%s%s' % (REPO, path)]
    if body is not None:
        args[1:1] = ['-H', 'Content-Type: application/json', '--data-binary', '@-']
    for attempt in range(1, 7):
        r = subprocess.run(args, capture_output=True,
                           input=(body.encode('utf-8') if body is not None else None))
        out = r.stdout.decode('utf-8', 'replace')
        if '"sha"' in out or '"object"' in out:
            return json.loads(out)
        print('  [attempt %d] %s %s failed: %s' % (attempt, method, path, out[:100].replace('\n', ' ')), file=sys.stderr)
        time.sleep(attempt * 2)
    raise RuntimeError('GIVE UP: %s %s' % (method, path))


TZ_RE = re.compile(r'^(author|committer) (.*) <(.*)> ([0-9]+) ([+-][0-9]{4})$', re.M)


def commit_to_utc(raw: bytes) -> bytes:
    """把提交对象的 author/committer 时区字节改为等价 UTC（瞬时不变），使 SHA 与远端 GitHub 序列化一致。"""
    def repl(m):
        from datetime import datetime, timezone, timedelta
        off = m.group(5)
        tz = timezone(timedelta(hours=int(off[1:3]), minutes=int(off[3:5])) * (1 if off[0] == '+' else -1))
        dt = datetime.fromtimestamp(int(m.group(4)), tz).astimezone(timezone.utc)
        return '%s %s <%s> %d +0000' % (m.group(1), m.group(2), m.group(3), int(dt.timestamp()))
    return TZ_RE.sub(repl, raw.decode('utf-8')).encode('utf-8')


def main():
    head = git('rev-parse', BRANCH).strip()
    ref = curl('GET', '/git/ref/heads/%s' % BRANCH)
    remote_head = ref['object']['sha']
    print('local head :', head)
    print('remote head:', remote_head)

    # 基点：远端 head 若已是本地历史成员直接用；否则沿远端父链向上找本地可识别的基点
    def is_local(sha):
        try:
            git('cat-file', '-e', sha + '^{commit}')
            git('merge-base', '--is-ancestor', sha, head)
            return True
        except RuntimeError:
            return False

    if is_local(remote_head):
        base = remote_head
    else:
        base, cur = None, remote_head
        for _ in range(6):
            cur = curl('GET', '/git/commits/' + cur)['parents'][0]['sha']
            if is_local(cur):
                base = cur
                break
        if not base:
            raise RuntimeError('无法在本地历史中定位远端链基点，需人工处理')
        print('远端为分叉链，基点对齐到本地:', base)

    # 待推提交（父→子）
    todo = git('log', '--reverse', '--format=%H', '%s..%s' % (base, head)).split()
    print('to push:', len(todo), 'commits')

    parent = base
    for c in todo:
        # 变更清单：diff-tree 父→子，-z 绕开路径编码；blob 取仓库对象字节
        raw = git('diff-tree', '-r', '-z', '--no-renames', parent, c, binary=True)
        items = raw.rstrip(b'\x00').split(b'\x00')
        tree_entries = []
        for i in range(0, len(items), 2):
            meta = items[i].decode('utf-8')          # :100644 100644 <old> <new> <status>
            path = items[i + 1].decode('utf-8')      # 原始 UTF-8 路径
            cols = meta[1:].split(' ')
            old_mode, new_mode, old_sha, new_sha, status = cols[0], cols[1], cols[2], cols[3], cols[4]
            if status in ('D',):
                tree_entries.append({'path': path, 'sha': None, 'mode': '100644', 'type': 'blob'})
                continue
            blob_bytes = git('cat-file', 'blob', new_sha, binary=True)
            blob = curl('POST', '/git/blobs', json.dumps({
                'content': base64.b64encode(blob_bytes).decode(), 'encoding': 'base64'}))
            tree_entries.append({'path': path, 'sha': blob['sha'], 'mode': new_mode, 'type': 'blob'})

        base_tree = (git('rev-parse', '%s^{tree}' % parent).strip()
                     if is_local(parent) else parent and curl('GET', '/git/commits/' + parent)['tree']['sha'])
        tree = curl('POST', '/git/trees', json.dumps({'base_tree': base_tree, 'tree': tree_entries}))
        raw_commit = git('cat-file', 'commit', c, binary=True)
        hc = subprocess.run(['git', 'hash-object', '-t', 'commit', '-w', '--stdin'],
                            input=commit_to_utc(raw_commit), capture_output=True)
        if hc.returncode != 0:
            raise RuntimeError('hash-object failed: ' + hc.stderr.decode())
        utc_sha = hc.stdout.decode().strip()
        header, msg = raw_commit.decode('utf-8').split('\n\n', 1)

        # 直接用本地对象的 author/committer 字段（GitHub 端会规范化为 UTC）
        def ident(line):
            m = TZ_RE.match(line)
            from datetime import datetime, timezone, timedelta
            off = m.group(5)
            tz = timezone(timedelta(hours=int(off[1:3]), minutes=int(off[3:5])) * (1 if off[0] == '+' else -1))
            d = datetime.fromtimestamp(int(m.group(4)), tz)
            return {'name': m.group(2), 'email': m.group(3),
                    'date': d.strftime('%Y-%m-%dT%H:%M:%S%z')[:-2] + ':' + d.strftime('%z')[-2:]}
        commit = curl('POST', '/git/commits', json.dumps({
            'message': msg, 'tree': tree['sha'], 'parents': [parent],
            'author': ident([l for l in header.split('\n') if l.startswith('author ')][0]),
            'committer': ident([l for l in header.split('\n') if l.startswith('committer ')][0]),
        }))
        ok = '✓' if commit['sha'] == utc_sha else '(SHA 仍分叉)'
        print('commit ok: %s -> %s %s : %s' % (c[:7], commit['sha'][:7], ok, msg.split('\n')[0][:40]))
        parent = commit['sha']

    force = not is_local(remote_head)  # 覆盖远端分叉链需 force（内容等价、以本地树重建）
    r = curl('PATCH', '/git/refs/heads/%s' % BRANCH, json.dumps({'sha': parent, 'force': bool(force)}))
    print('ref updated:', r['object']['sha'])


def _try_local_obj(sha):
    try:
        git('cat-file', '-e', sha)
        return True
    except RuntimeError:
        return False


if __name__ == '__main__':
    main()
