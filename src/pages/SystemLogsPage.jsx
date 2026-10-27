// ============================================================
// 日志管理（/system/logs · 基础配置域）
// 登录日志 + 系统操作日志（Tabs 两视图，共用筛选/导出/清空口径）：
//   - 只读种子来自 src/data/systemConfig.js（sysLoginLogs + sysOperationLogs）
//   - 查询/导出/清空均为页面内演示交互，不写入 DemoStore（刷新恢复）
//   - 口径：登录日志记录登录成败与失败原因；操作日志记录关键业务动作
//     （新增/修改/删除/导入/导出/状态流转/分配权限/重置密码），供追溯审计
// ============================================================

import React, { useMemo, useState } from 'react';
import { App, Button, Card, Input, Popconfirm, Select, Space, Table, Tabs, Tag } from 'antd';
import { Download, Eraser } from 'lucide-react';
import PageHeader from '../components/PageHeader.jsx';
import StatusTag from '../components/StatusTag.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { sysLoginLogs, sysOperationLogs } from '../data/systemConfig.js';

const OP_TYPE_COLOR = {
  新增: 'blue', 修改: 'gold', 删除: 'red', 导入: 'purple', 导出: 'cyan',
  状态流转: 'processing', 分配权限: 'orange', 重置密码: 'orange',
};

export default function SystemLogsPage() {
  const { message } = App.useApp();

  const [loginRows, setLoginRows] = useState(sysLoginLogs);
  const [opRows, setOpRows] = useState(sysOperationLogs);
  const [tab, setTab] = useState('login');

  // 登录日志筛选
  const [loginKw, setLoginKw] = useState('');
  const [loginUser, setLoginUser] = useState(null);
  const [loginResult, setLoginResult] = useState(null);
  // 操作日志筛选
  const [opKw, setOpKw] = useState('');
  const [opModule, setOpModule] = useState(null);
  const [opUser, setOpUser] = useState(null);
  const [opResult, setOpResult] = useState(null);

  const userOptions = [...new Set([...sysLoginLogs.map((l) => l.userName), ...sysOperationLogs.map((l) => l.userName)])]
    .map((v) => ({ value: v, label: v }));
  const moduleOptions = [...new Set(sysOperationLogs.map((l) => l.module))].map((v) => ({ value: v, label: v }));
  const resultOptions = ['成功', '失败'].map((v) => ({ value: v, label: v }));

  const loginList = useMemo(() => loginRows
    .filter((l) => !loginUser || l.userName === loginUser)
    .filter((l) => !loginResult || l.result === loginResult)
    .filter((l) => !loginKw || [l.userName, l.account, l.ip, l.location]
      .some((v) => String(v || '').includes(loginKw.trim()))),
  [loginRows, loginKw, loginUser, loginResult]);

  const opList = useMemo(() => opRows
    .filter((l) => !opModule || l.module === opModule)
    .filter((l) => !opUser || l.userName === opUser)
    .filter((l) => !opResult || l.result === opResult)
    .filter((l) => !opKw || [l.userName, l.content, l.ip]
      .some((v) => String(v || '').includes(opKw.trim()))),
  [opRows, opKw, opModule, opUser, opResult]);

  const failCount = (rows) => rows.filter((l) => l.result === '失败').length;

  return (
    <>
      <PageHeader
        title="日志管理"
        subtitle="数据更新于 2026-09-16"
      />

      <Card size="small">
        <Tabs
          activeKey={tab}
          onChange={setTab}
          items={[
            {
              key: 'login',
              label: <span>登录日志 <Tag color={failCount(loginRows) ? 'error' : 'default'}>{failCount(loginRows)} 失败</Tag></span>,
              children: (
                <>
                  <Card size="small" style={{ marginBottom: 12 }}>
                    <Space wrap>
                      <Input.Search style={{ width: 220 }} placeholder="用户 / 账号 / IP / 登录地点" allowClear
                        onSearch={setLoginKw} onChange={(e) => { if (!e.target.value) setLoginKw(''); }} />
                      <Select style={{ width: 130 }} placeholder="操作用户" allowClear showSearch optionFilterProp="label"
                        options={userOptions} value={loginUser} onChange={setLoginUser} />
                      <Select style={{ width: 110 }} placeholder="登录结果" allowClear
                        options={resultOptions} value={loginResult} onChange={setLoginResult} />
                      <Button onClick={() => { setLoginKw(''); setLoginUser(null); setLoginResult(null); }}>重置</Button>
                    </Space>
                  </Card>
                  <Card size="small">
                    <Space wrap style={{ marginBottom: 12 }}>
                      <Button icon={<Download size={14} />}>导出</Button>
                      <Popconfirm
                        title="确认清空全部登录日志？"
                        description="清空后不可恢复；如需留档请先导出（演示模式：刷新页面后恢复）。"
                        onConfirm={() => { setLoginRows([]); message.success('登录日志已清空（演示模式：刷新页面后恢复）'); }}
                      >
                        <Button danger icon={<Eraser size={14} />}>清空</Button>
                      </Popconfirm>
                    </Space>
                    <Table
                      rowKey="logId" size="small"
                      dataSource={loginList}
                      locale={{ emptyText: <EmptyState description="暂无登录日志"
                        reason={loginKw || loginUser || loginResult ? '当前筛选条件下没有登录日志' : '日志已清空，等待新的登录记录写入'} /> }}
                      columns={[
                        { title: '日志编号', dataIndex: 'logId', width: 180, fixed: 'left' },
                        { title: '登录时间', dataIndex: 'time', width: 160 },
                        { title: '用户', dataIndex: 'userName', width: 100 },
                        { title: '账号', dataIndex: 'account', width: 120 },
                        { title: '部门', dataIndex: 'dept', width: 170 },
                        { title: 'IP 地址', dataIndex: 'ip', width: 130 },
                        { title: '登录地点', dataIndex: 'location', width: 150 },
                        { title: '浏览器', dataIndex: 'browser', width: 110 },
                        { title: '操作系统', dataIndex: 'os', width: 120 },
                        { title: '结果', dataIndex: 'result', width: 90, render: (v) => <StatusTag value={v === '成功' ? '成功' : '失败'} /> },
                        { title: '描述', dataIndex: 'message', width: 260, ellipsis: true },
                      ]}
                      scroll={{ x: 1600 }}
                      pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 条` }}
                    />
                  </Card>
                </>
              ),
            },
            {
              key: 'operation',
              label: <span>系统操作日志 <Tag color="default">{opRows.length} 条</Tag></span>,
              children: (
                <>
                  <Card size="small" style={{ marginBottom: 12 }}>
                    <Space wrap>
                      <Input.Search style={{ width: 220 }} placeholder="操作人 / 操作内容 / IP" allowClear
                        onSearch={setOpKw} onChange={(e) => { if (!e.target.value) setOpKw(''); }} />
                      <Select style={{ width: 130 }} placeholder="所属模块" allowClear showSearch optionFilterProp="label"
                        options={moduleOptions} value={opModule} onChange={setOpModule} />
                      <Select style={{ width: 130 }} placeholder="操作人" allowClear showSearch optionFilterProp="label"
                        options={userOptions} value={opUser} onChange={setOpUser} />
                      <Select style={{ width: 110 }} placeholder="操作结果" allowClear
                        options={resultOptions} value={opResult} onChange={setOpResult} />
                      <Button onClick={() => { setOpKw(''); setOpModule(null); setOpUser(null); setOpResult(null); }}>重置</Button>
                    </Space>
                  </Card>
                  <Card size="small">
                    <Space wrap style={{ marginBottom: 12 }}>
                      <Button icon={<Download size={14} />}>导出</Button>
                      <Popconfirm
                        title="确认清空全部操作日志？"
                        description="清空后不可恢复；如需留档请先导出（演示模式：刷新页面后恢复）。"
                        onConfirm={() => { setOpRows([]); message.success('操作日志已清空（演示模式：刷新页面后恢复）'); }}
                      >
                        <Button danger icon={<Eraser size={14} />}>清空</Button>
                      </Popconfirm>
                    </Space>
                    <Table
                      rowKey="logId" size="small"
                      dataSource={opList}
                      locale={{ emptyText: <EmptyState description="暂无操作日志"
                        reason={opKw || opModule || opUser || opResult ? '当前筛选条件下没有操作日志' : '日志已清空，等待新的操作记录写入'} /> }}
                      columns={[
                        { title: '日志编号', dataIndex: 'logId', width: 180, fixed: 'left' },
                        { title: '操作时间', dataIndex: 'time', width: 160 },
                        { title: '操作人', dataIndex: 'userName', width: 100 },
                        { title: '部门', dataIndex: 'dept', width: 170 },
                        { title: '所属模块', dataIndex: 'module', width: 110 },
                        { title: '操作类型', dataIndex: 'type', width: 100, render: (v) => <Tag color={OP_TYPE_COLOR[v] || 'default'}>{v}</Tag> },
                        { title: '操作内容', dataIndex: 'content', ellipsis: true },
                        { title: 'IP 地址', dataIndex: 'ip', width: 130 },
                        { title: '结果', dataIndex: 'result', width: 90, render: (v) => <StatusTag value={v} /> },
                        { title: '耗时', width: 90, render: (_, r) => r.costMs != null ? `${r.costMs} ms` : '--' },
                      ]}
                      scroll={{ x: 1500 }}
                      pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 条` }}
                    />
                  </Card>
                </>
              ),
            },
          ]}
        />
      </Card>
    </>
  );
}
