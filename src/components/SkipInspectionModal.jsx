import React, { useEffect, useState } from 'react';
import { Modal, Form, Input, Row, Col } from 'antd';

// 跳过点检弹窗（原型「跳过点检.html」）：单字段「跳过原因」，按钮 取消 / 确认。
export default function SkipInspectionModal({ open, title = '跳过点检', onCancel, onConfirm }) {
  const [form] = Form.useForm();
  useEffect(() => {
    if (open) form.resetFields();
  }, [open, form]);

  const handleOk = async () => {
    const values = await form.validateFields();
    onConfirm?.(values.reason);
  };

  return (
    <Modal
      title={title}
      width={520}
      open={open}
      destroyOnClose
      onCancel={onCancel}
      onOk={handleOk}
      okText="确认"
      cancelText="取消"
    >
      <Form form={form} layout="vertical">
        <Row gutter={16}>
          <Col span={24}>
            <Form.Item
              label="跳过原因"
              name="reason"
              rules={[{ required: true, message: '请输入跳过原因' }]}
            >
              <Input.TextArea rows={3} maxLength={200} showCount placeholder="请输入跳过原因" />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Modal>
  );
}
