import React, { useEffect } from 'react';
import { Modal, Form, Input } from 'antd';

// 跳过巡检弹窗（对齐原型「跳过巡检.html」）：唯一字段为「跳过原因」（多行文本），
// 底部按钮为「取消」「确认」。原型未给出预设原因枚举，故自由填写。
export default function PatrolSkipModal({
  open,
  title = '跳过巡检',
  deviceLabel,
  onCancel,
  onConfirm,
}) {
  const [form] = Form.useForm();

  useEffect(() => {
    if (open) form.setFieldsValue({ skipReason: '' });
  }, [open, form]);

  const handleOk = async () => {
    const values = await form.validateFields();
    onConfirm?.(values.skipReason);
  };

  return (
    <Modal
      title={title}
      open={open}
      onCancel={onCancel}
      onOk={handleOk}
      okText="确认"
      cancelText="取消"
      width={520}
      destroyOnHidden
    >
      {deviceLabel && (
        <div style={{ marginBottom: 12, color: '#5a6a78', fontSize: 13 }}>
          设备：{deviceLabel}
        </div>
      )}
      <Form form={form} layout="vertical">
        <Form.Item
          label="跳过原因"
          name="skipReason"
          rules={[{ required: true, message: '请输入跳过原因' }]}
        >
          <Input.TextArea rows={4} maxLength={200} showCount placeholder="请输入跳过原因" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
