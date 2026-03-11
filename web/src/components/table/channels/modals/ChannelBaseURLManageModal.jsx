/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Modal,
  Button,
  Table,
  Tag,
  Typography,
  Space,
  Popconfirm,
  Empty,
  Spin,
  Input,
  InputNumber,
  Switch,
} from '@douyinfe/semi-ui';
import {
  IllustrationNoResult,
  IllustrationNoResultDark,
} from '@douyinfe/semi-illustrations';
import { API, showError, showSuccess } from '../../../../helpers';

const { Text } = Typography;

const normalizeEnabled = (value) => {
  return value === true || value === 1 || value === '1';
};

const getBaseUrlId = (item) => {
  return item?.base_url_id ?? item?.id ?? item?.url_id;
};

const ChannelBaseURLManageModal = ({
  visible,
  onCancel,
  channel,
  onRefresh,
  onBaseUrlsUpdated,
}) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [baseUrlList, setBaseUrlList] = useState([]);
  const [operationLoading, setOperationLoading] = useState({});

  const [showEditor, setShowEditor] = useState(false);
  const [editorSubmitting, setEditorSubmitting] = useState(false);
  const [editorMode, setEditorMode] = useState('add'); // add | edit
  const [editorBaseUrlId, setEditorBaseUrlId] = useState(undefined);
  const [editorUrl, setEditorUrl] = useState('');
  const [editorEnabled, setEditorEnabled] = useState(true);
  const [editorWeight, setEditorWeight] = useState(1);
  const [editorSortOrder, setEditorSortOrder] = useState(0);

  const resetEditor = () => {
    setEditorMode('add');
    setEditorBaseUrlId(undefined);
    setEditorUrl('');
    setEditorEnabled(true);
    setEditorWeight(1);
    setEditorSortOrder(0);
  };

  const loadBaseUrls = async () => {
    if (!channel?.id) return;
    setLoading(true);
    try {
      const res = await API.post('/api/channel/base_url/manage', {
        channel_id: channel.id,
        action: 'list',
      });
      const { success, message, data } = res?.data || {};
      if (!success) {
        showError(message || t('获取 BaseURL 列表失败'));
        return;
      }
      const list =
        data?.base_urls || data?.items || data?.list || data?.urls || [];
      setBaseUrlList(Array.isArray(list) ? list : []);
    } catch (error) {
      const errMsg =
        error?.response?.data?.message || error?.message || t('获取失败');
      showError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const callManage = async (payload) => {
    return API.post('/api/channel/base_url/manage', {
      channel_id: channel.id,
      ...payload,
    });
  };

  const handleEnableToggle = async (item, nextEnabled) => {
    const baseUrlId = getBaseUrlId(item);
    if (!baseUrlId) {
      showError(t('BaseURL ID 缺失'));
      return;
    }
    const operationId = `${nextEnabled ? 'enable' : 'disable'}_${baseUrlId}`;
    setOperationLoading((prev) => ({ ...prev, [operationId]: true }));
    try {
      const res = await callManage({
        action: nextEnabled ? 'enable' : 'disable',
        base_url_id: baseUrlId,
      });
      const { success, message } = res?.data || {};
      if (!success) {
        showError(message || t('操作失败'));
        return;
      }
      showSuccess(message || t('操作成功'));
      await loadBaseUrls();
      onRefresh && onRefresh();
      onBaseUrlsUpdated && onBaseUrlsUpdated(channel.id);
    } catch (error) {
      const errMsg =
        error?.response?.data?.message || error?.message || t('操作失败');
      showError(errMsg);
    } finally {
      setOperationLoading((prev) => ({ ...prev, [operationId]: false }));
    }
  };

  const handleDelete = async (item) => {
    const baseUrlId = getBaseUrlId(item);
    if (!baseUrlId) {
      showError(t('BaseURL ID 缺失'));
      return;
    }
    const operationId = `delete_${baseUrlId}`;
    setOperationLoading((prev) => ({ ...prev, [operationId]: true }));
    try {
      const res = await callManage({
        action: 'delete',
        base_url_id: baseUrlId,
      });
      const { success, message } = res?.data || {};
      if (!success) {
        showError(message || t('删除失败'));
        return;
      }
      showSuccess(message || t('删除成功'));
      await loadBaseUrls();
      onRefresh && onRefresh();
      onBaseUrlsUpdated && onBaseUrlsUpdated(channel.id);
    } catch (error) {
      const errMsg =
        error?.response?.data?.message || error?.message || t('删除失败');
      showError(errMsg);
    } finally {
      setOperationLoading((prev) => ({ ...prev, [operationId]: false }));
    }
  };

  const openAdd = () => {
    resetEditor();
    setEditorMode('add');
    setShowEditor(true);
  };

  const openEdit = (item) => {
    const baseUrlId = getBaseUrlId(item);
    setEditorMode('edit');
    setEditorBaseUrlId(baseUrlId);
    setEditorUrl(item?.url || '');
    setEditorEnabled(normalizeEnabled(item?.enabled));
    setEditorWeight(
      Number.isFinite(Number(item?.weight)) ? Number(item?.weight) : 1,
    );
    setEditorSortOrder(
      Number.isFinite(Number(item?.sort_order)) ? Number(item?.sort_order) : 0,
    );
    setShowEditor(true);
  };

  const submitEditor = async () => {
    if (!channel?.id) return;
    if (!editorUrl || editorUrl.trim() === '') {
      showError(t('请输入 URL'));
      return;
    }
    if (editorMode === 'edit' && !editorBaseUrlId) {
      showError(t('BaseURL ID 缺失'));
      return;
    }

    setEditorSubmitting(true);
    try {
      const payload = {
        action: editorMode === 'add' ? 'add' : 'update',
        url: editorUrl.trim(),
        enabled: editorEnabled,
        weight: editorWeight,
        sort_order: editorSortOrder,
      };
      if (editorMode === 'edit') {
        payload.base_url_id = editorBaseUrlId;
      }
      const res = await callManage(payload);
      const { success, message } = res?.data || {};
      if (!success) {
        showError(message || t('保存失败'));
        return;
      }
      showSuccess(message || t('保存成功'));
      setShowEditor(false);
      resetEditor();
      await loadBaseUrls();
      onRefresh && onRefresh();
      onBaseUrlsUpdated && onBaseUrlsUpdated(channel.id);
    } catch (error) {
      const errMsg =
        error?.response?.data?.message || error?.message || t('保存失败');
      showError(errMsg);
    } finally {
      setEditorSubmitting(false);
    }
  };

  useEffect(() => {
    if (visible && channel?.id) {
      loadBaseUrls();
    }
  }, [visible, channel?.id]);

  useEffect(() => {
    if (!visible) {
      setLoading(false);
      setBaseUrlList([]);
      setOperationLoading({});
      setShowEditor(false);
      setEditorSubmitting(false);
      resetEditor();
    }
  }, [visible]);

  const columns = useMemo(() => {
    return [
      {
        title: 'ID',
        dataIndex: 'id',
        width: 90,
        render: (text, record) => {
          const baseUrlId = getBaseUrlId(record);
          return <Text type='tertiary'>#{baseUrlId ?? '-'}</Text>;
        },
      },
      {
        title: t('URL'),
        dataIndex: 'url',
        render: (text) => (
          <Text code style={{ fontSize: 12 }}>
            {text || '-'}
          </Text>
        ),
      },
      {
        title: t('启用'),
        dataIndex: 'enabled',
        width: 90,
        render: (enabled) =>
          normalizeEnabled(enabled) ? (
            <Tag color='green' shape='circle' size='small'>
              {t('已启用')}
            </Tag>
          ) : (
            <Tag color='grey' shape='circle' size='small'>
              {t('已禁用')}
            </Tag>
          ),
      },
      {
        title: t('权重'),
        dataIndex: 'weight',
        width: 90,
        render: (w) => <Text>{Number.isFinite(Number(w)) ? w : '-'}</Text>,
      },
      {
        title: t('排序'),
        dataIndex: 'sort_order',
        width: 90,
        render: (v) => <Text>{Number.isFinite(Number(v)) ? v : '-'}</Text>,
      },
      {
        title: t('操作'),
        key: 'action',
        fixed: 'right',
        width: 220,
        render: (_, record) => {
          const baseUrlId = getBaseUrlId(record);
          const enabled = normalizeEnabled(record?.enabled);
          return (
            <Space>
              <Button
                size='small'
                type={enabled ? 'danger' : 'primary'}
                loading={
                  operationLoading[
                    `${enabled ? 'disable' : 'enable'}_${baseUrlId}`
                  ]
                }
                onClick={() => handleEnableToggle(record, !enabled)}
              >
                {enabled ? t('禁用') : t('启用')}
              </Button>
              <Button
                size='small'
                type='tertiary'
                onClick={() => openEdit(record)}
              >
                {t('编辑')}
              </Button>
              <Popconfirm
                title={t('确认删除该 BaseURL 吗？')}
                content={t('此操作不可撤销')}
                okType='danger'
                position='topRight'
                onConfirm={() => handleDelete(record)}
              >
                <Button
                  size='small'
                  type='danger'
                  loading={operationLoading[`delete_${baseUrlId}`]}
                >
                  {t('删除')}
                </Button>
              </Popconfirm>
            </Space>
          );
        },
      },
    ];
  }, [operationLoading, t]);

  const tableData = useMemo(() => {
    return baseUrlList.map((item, idx) => ({
      ...item,
      key: String(getBaseUrlId(item) ?? idx),
    }));
  }, [baseUrlList]);

  return (
    <>
      <Modal
        title={
          channel?.name
            ? `${channel.name} ${t('BaseURL 管理')}`
            : t('BaseURL 管理')
        }
        visible={visible}
        onCancel={onCancel}
        footer={
          <div className='flex justify-end gap-2'>
            <Button type='tertiary' onClick={onCancel}>
              {t('关闭')}
            </Button>
          </div>
        }
        maskClosable={false}
        className='!rounded-lg'
        size='large'
      >
        <Spin spinning={loading}>
          <Table
            columns={columns}
            dataSource={tableData}
            pagination={false}
            size='small'
            bordered={false}
            rowKey='key'
            scroll={{ x: 'max-content' }}
            title={() => (
              <div className='flex items-center justify-between gap-2'>
                <Text type='tertiary'>
                  {t('共')} {baseUrlList.length} {t('条')}
                </Text>
                <Space>
                  <Button
                    size='small'
                    type='tertiary'
                    onClick={loadBaseUrls}
                    loading={loading}
                  >
                    {t('刷新')}
                  </Button>
                  <Button size='small' type='primary' onClick={openAdd}>
                    {t('新增')}
                  </Button>
                </Space>
              </div>
            )}
            empty={
              <Empty
                image={
                  <IllustrationNoResult style={{ width: 140, height: 140 }} />
                }
                darkModeImage={
                  <IllustrationNoResultDark
                    style={{ width: 140, height: 140 }}
                  />
                }
                title={t('暂无 BaseURL')}
                description={t('可点击右上角新增')}
                style={{ padding: 30 }}
              />
            }
          />
        </Spin>
      </Modal>

      <Modal
        title={editorMode === 'add' ? t('新增 BaseURL') : t('编辑 BaseURL')}
        visible={showEditor}
        onCancel={() => {
          if (editorSubmitting) return;
          setShowEditor(false);
          resetEditor();
        }}
        onOk={submitEditor}
        okText={t('保存')}
        confirmLoading={editorSubmitting}
        maskClosable={false}
        className='!rounded-lg'
      >
        <div className='flex flex-col gap-4'>
          <div className='flex flex-col gap-2'>
            <Text strong>{t('URL')}</Text>
            <Input
              value={editorUrl}
              onChange={setEditorUrl}
              placeholder={t('例如：https://api.example.com')}
              showClear
            />
          </div>

          <div className='flex items-center justify-between gap-4'>
            <Text strong>{t('启用')}</Text>
            <Switch checked={editorEnabled} onChange={setEditorEnabled} />
          </div>

          <div className='flex items-center gap-4'>
            <div className='flex flex-col gap-2 flex-1'>
              <Text strong>{t('权重')}</Text>
              <InputNumber
                value={editorWeight}
                onChange={setEditorWeight}
                min={0}
                precision={0}
                placeholder={t('权重')}
                style={{ width: '100%' }}
              />
            </div>
            <div className='flex flex-col gap-2 flex-1'>
              <Text strong>{t('排序')}</Text>
              <InputNumber
                value={editorSortOrder}
                onChange={setEditorSortOrder}
                precision={0}
                placeholder={t('排序')}
                style={{ width: '100%' }}
              />
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default ChannelBaseURLManageModal;

