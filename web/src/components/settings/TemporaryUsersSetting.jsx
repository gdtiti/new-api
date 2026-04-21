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

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  API,
  copy,
  getCurrencyConfig,
  renderQuota,
  renderQuotaWithPrompt,
  showError,
  showSuccess,
  timestamp2string,
} from '../../helpers';
import {
  displayAmountToQuota,
} from '../../helpers/quota';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '../../hooks/common/useIsMobile';
import {
  Avatar,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Form,
  Modal,
  Row,
  SideSheet,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from '@douyinfe/semi-ui';
import {
  IconClose,
  IconKey,
  IconRefresh,
  IconSave,
  IconUserAdd,
} from '@douyinfe/semi-icons';

const { Text, Title } = Typography;

const USER_STATUS_ENABLED = 1;
const USER_STATUS_DISABLED = 2;
const TOKEN_STATUS_ENABLED = 1;
const TOKEN_STATUS_DISABLED = 2;
const TOKEN_STATUS_EXPIRED = 3;
const TOKEN_STATUS_EXHAUSTED = 4;

const TemporaryUsersSetting = () => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const formApiRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [groupLoading, setGroupLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [managingId, setManagingId] = useState(0);
  const [temporaryUsers, setTemporaryUsers] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [groupOptions, setGroupOptions] = useState([]);
  const [createVisible, setCreateVisible] = useState(false);
  const [createdResult, setCreatedResult] = useState(null);
  const currencyConfig = getCurrencyConfig();
  const quotaInputIsAmount = currencyConfig.type !== 'TOKENS';

  const getInitValues = (groups = []) => ({
    username: '',
    password: '',
    display_name: '',
    remark: '',
    initial_quota: 0,
    user_group: groups[0]?.value || '',
    token_group: 'auto',
    token_name: 'temporary-default',
    token_unlimited_quota: true,
    token_remain_quota: 0,
    token_expired_time: null,
  });

  const tokenGroupOptions = useMemo(() => {
    return [
      {
        label: t('自动跟随用户分组'),
        value: 'auto',
      },
      ...groupOptions,
    ];
  }, [groupOptions, t]);

  const loadGroups = async () => {
    setGroupLoading(true);
    try {
      const res = await API.get('/api/group/');
      if (res?.data?.success) {
        setGroupOptions(
          (res.data.data || []).map((group) => ({
            label: group,
            value: group,
          })),
        );
      } else {
        setGroupOptions([]);
      }
    } catch (error) {
      setGroupOptions([]);
    } finally {
      setGroupLoading(false);
    }
  };

  const loadTemporaryUsers = async (nextPage = page, nextPageSize = pageSize) => {
    setLoading(true);
    try {
      const res = await API.get(
        `/api/temporary-user?p=${nextPage}&page_size=${nextPageSize}`,
      );
      const { success, message, data } = res.data;
      if (success) {
        setTemporaryUsers(data?.items || []);
        setPage(data?.page || nextPage || 1);
        setPageSize(data?.page_size || nextPageSize);
        setTotal(data?.total || 0);
      } else {
        showError(message);
      }
    } catch (error) {
      showError(error.message || t('获取临时账号列表失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGroups().then();
    loadTemporaryUsers(1, pageSize).then();
  }, []);

  useEffect(() => {
    if (!createVisible || !formApiRef.current) {
      return;
    }
    formApiRef.current.setValues(getInitValues(groupOptions));
  }, [createVisible, groupOptions]);

  const openCreatePanel = () => {
    setCreateVisible(true);
  };

  const closeCreatePanel = () => {
    setCreateVisible(false);
    formApiRef.current?.reset();
  };

  const handleCopy = async (value, successText) => {
    if (!value) {
      showError(t('没有可复制的内容'));
      return;
    }
    const copied = await copy(value);
    if (copied) {
      showSuccess(successText);
      return;
    }
    showError(t('复制失败，请手动复制'));
  };

  const createTemporaryUser = async (values) => {
    const payload = {
      ...values,
      initial_quota: displayAmountToQuota(values.initial_quota || 0),
      token_group: values.token_group || 'auto',
      token_name: values.token_name || 'temporary-default',
      token_unlimited_quota: values.token_unlimited_quota !== false,
      token_remain_quota: values.token_unlimited_quota
        ? 0
        : displayAmountToQuota(values.token_remain_quota || 0),
    };
    if (values.token_expired_time instanceof Date) {
      payload.token_expired_time = Math.floor(
        values.token_expired_time.getTime() / 1000,
      );
    } else {
      delete payload.token_expired_time;
    }

    setSubmitLoading(true);
    try {
      const res = await API.post('/api/temporary-user', payload);
      const { success, message, data } = res.data;
      if (success) {
        showSuccess(t('临时账号创建成功'));
        setCreatedResult(data);
        closeCreatePanel();
        await loadTemporaryUsers(1, pageSize);
      } else {
        showError(message);
      }
    } catch (error) {
      showError(error.message || t('请求失败'));
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleManageTemporaryUser = async (record, action) => {
    if (!record?.id) return;
    const actionText = action === 'enable' ? t('启用') : t('禁用');
    setManagingId(record.id);
    try {
      const res = await API.post('/api/temporary-user/manage', {
        id: record.id,
        action,
      });
      const { success, message } = res.data;
      if (success) {
        showSuccess(t('{{action}}成功', { action: actionText }));
        await loadTemporaryUsers(page, pageSize);
      } else {
        showError(message);
      }
    } catch (error) {
      showError(error.message || t('请求失败'));
    } finally {
      setManagingId(0);
    }
  };

  const renderUserStatus = (status) => {
    if (status === USER_STATUS_ENABLED) {
      return (
        <Tag color='green' shape='circle'>
          {t('已启用')}
        </Tag>
      );
    }
    if (status === USER_STATUS_DISABLED) {
      return (
        <Tag color='red' shape='circle'>
          {t('已禁用')}
        </Tag>
      );
    }
    return (
      <Tag color='grey' shape='circle'>
        {t('未知状态')}
      </Tag>
    );
  };

  const renderTokenStatus = (status) => {
    switch (status) {
      case TOKEN_STATUS_ENABLED:
        return (
          <Tag color='green' shape='circle'>
            {t('已启用')}
          </Tag>
        );
      case TOKEN_STATUS_DISABLED:
        return (
          <Tag color='red' shape='circle'>
            {t('已禁用')}
          </Tag>
        );
      case TOKEN_STATUS_EXPIRED:
        return (
          <Tag color='orange' shape='circle'>
            {t('已过期')}
          </Tag>
        );
      case TOKEN_STATUS_EXHAUSTED:
        return (
          <Tag color='grey' shape='circle'>
            {t('已耗尽')}
          </Tag>
        );
      default:
        return (
          <Tag color='grey' shape='circle'>
            {t('未知状态')}
          </Tag>
        );
    }
  };

  const columns = [
    {
      title: t('用户'),
      dataIndex: 'username',
      render: (text, record) => (
        <div>
          <div className='font-medium'>{text}</div>
          <div className='text-xs text-gray-500'>
            {record.display_name || t('未设置显示名称')}
          </div>
        </div>
      ),
    },
    {
      title: t('状态'),
      dataIndex: 'status',
      render: (text) => renderUserStatus(text),
    },
    {
      title: t('余额'),
      dataIndex: 'quota',
      render: (text) => renderQuota(Number(text || 0)),
    },
    {
      title: t('用户分组'),
      dataIndex: 'group',
      render: (text) => <Tag shape='circle'>{text || t('未设置')}</Tag>,
    },
    {
      title: t('默认令牌'),
      dataIndex: 'default_token_masked',
      render: (text, record) => (
        <div className='flex flex-col gap-1'>
          <Text>{text || t('未生成')}</Text>
          <Space wrap>
            <Tag color='blue' shape='circle'>
              {record.default_token_group || t('未设置分组')}
            </Tag>
            {renderTokenStatus(record.default_token_status)}
          </Space>
        </div>
      ),
    },
    {
      title: t('默认令牌额度'),
      dataIndex: 'default_token_remain_quota',
      render: (text, record) =>
        record.default_token_unlimited_quota
          ? t('不限额')
          : renderQuota(Number(text || 0)),
    },
    {
      title: t('默认令牌过期时间'),
      dataIndex: 'default_token_expired_time',
      render: (text) => {
        if (!text || Number(text) < 0) {
          return t('永不过期');
        }
        return timestamp2string(text);
      },
    },
    {
      title: t('开通时间'),
      dataIndex: 'opened_time',
      render: (text) => (text ? timestamp2string(text) : t('未知')),
    },
    {
      title: t('创建者'),
      dataIndex: 'temporary_creator_name',
      render: (text, record) => text || record.temporary_created_by || t('未知'),
    },
    {
      title: t('备注'),
      dataIndex: 'remark',
      render: (text) => text || t('无'),
    },
    {
      title: t('操作'),
      dataIndex: 'operate',
      fixed: isMobile ? undefined : 'right',
      width: 150,
      render: (_, record) => {
        const enabled = record.status === USER_STATUS_ENABLED;
        return (
          <Button
            size='small'
            type={enabled ? 'danger' : 'primary'}
            loading={managingId === record.id}
            onClick={() =>
              handleManageTemporaryUser(
                record,
                enabled ? 'disable' : 'enable',
              )
            }
          >
            {enabled ? t('禁用') : t('启用')}
          </Button>
        );
      },
    },
  ];

  return (
    <>
      <Card style={{ marginTop: 10 }}>
        <div className='flex flex-col gap-3'>
          <div className='flex flex-col md:flex-row md:items-center md:justify-between gap-3'>
            <div>
              <Title heading={5} className='!mb-1'>
                {t('临时账号管理')}
              </Title>
              <Text type='secondary'>
                {t(
                  '集中管理通过管理令牌开通的临时账号、默认令牌与自动禁用后的状态。',
                )}
              </Text>
            </div>
            <Space wrap>
              <Button
                icon={<IconRefresh />}
                loading={loading}
                onClick={() => loadTemporaryUsers(page, pageSize)}
              >
                {t('刷新')}
              </Button>
              <Button
                type='primary'
                icon={<IconUserAdd />}
                onClick={openCreatePanel}
              >
                {t('开通临时账号')}
              </Button>
            </Space>
          </div>

          <Table
            rowKey='id'
            columns={columns}
            dataSource={temporaryUsers}
            loading={loading}
            scroll={isMobile ? undefined : { x: 'max-content' }}
            empty={
              <Empty
                description={t('暂无临时账号')}
                style={{ padding: 24 }}
              />
            }
            pagination={{
              currentPage: page,
              pageSize,
              total,
              showSizeChanger: true,
              pageSizeOptions: [10, 20, 50],
              onPageChange: (nextPage) => {
                setPage(nextPage);
                loadTemporaryUsers(nextPage, pageSize).then();
              },
              onPageSizeChange: (nextPageSize) => {
                setPage(1);
                setPageSize(nextPageSize);
                loadTemporaryUsers(1, nextPageSize).then();
              },
            }}
          />
        </div>
      </Card>

      <SideSheet
        placement='right'
        title={
          <Space>
            <Tag color='green' shape='circle'>
              {t('新建')}
            </Tag>
            <Title heading={4} className='m-0'>
              {t('开通临时账号')}
            </Title>
          </Space>
        }
        bodyStyle={{ padding: '0' }}
        visible={createVisible}
        width={isMobile ? '100%' : 640}
        footer={
          <div className='flex justify-end bg-white'>
            <Space>
              <Button
                theme='solid'
                icon={<IconSave />}
                loading={submitLoading}
                onClick={() => formApiRef.current?.submitForm()}
              >
                {t('提交')}
              </Button>
              <Button
                theme='light'
                type='primary'
                icon={<IconClose />}
                onClick={closeCreatePanel}
              >
                {t('取消')}
              </Button>
            </Space>
          </div>
        }
        closeIcon={null}
        onCancel={closeCreatePanel}
      >
        <Spin spinning={submitLoading || groupLoading}>
          <Form
            initValues={getInitValues(groupOptions)}
            getFormApi={(api) => (formApiRef.current = api)}
            onSubmit={createTemporaryUser}
            onSubmitFail={(errs) => {
              const first = Object.values(errs)[0];
              if (first) showError(Array.isArray(first) ? first[0] : first);
              formApiRef.current?.scrollToError();
            }}
          >
            {({ values }) => (
              <div className='p-2'>
                <Card className='!rounded-2xl shadow-sm border-0 mb-6'>
                  <div className='flex items-center mb-2'>
                    <Avatar
                      size='small'
                      color='blue'
                      className='mr-2 shadow-md'
                    >
                      <IconUserAdd size={16} />
                    </Avatar>
                    <div>
                      <Text className='text-lg font-medium'>
                        {t('账号信息')}
                      </Text>
                      <div className='text-xs text-gray-600'>
                        {t('可留空用户名和密码，由系统自动生成。')}
                      </div>
                    </div>
                  </div>

                  <Row gutter={12}>
                    <Col span={12}>
                      <Form.Input
                        field='username'
                        label={t('用户名')}
                        placeholder={t('留空自动生成')}
                        showClear
                      />
                    </Col>
                    <Col span={12}>
                      <Form.Input
                        field='password'
                        label={t('密码')}
                        type='password'
                        placeholder={t('留空自动生成')}
                        showClear
                      />
                    </Col>
                    <Col span={12}>
                      <Form.Input
                        field='display_name'
                        label={t('显示名称')}
                        placeholder={t('留空默认使用用户名')}
                        showClear
                      />
                    </Col>
                    <Col span={12}>
                      <Form.InputNumber
                        field='initial_quota'
                        label={t('初始余额')}
                        min={0}
                        precision={quotaInputIsAmount ? 2 : 0}
                        step={quotaInputIsAmount ? 1 : 500000}
                        style={{ width: '100%' }}
                        extraText={
                          quotaInputIsAmount
                            ? t('按当前显示金额输入，保存时会自动换算为系统额度')
                            : renderQuotaWithPrompt(Number(values.initial_quota || 0))
                        }
                      />
                    </Col>
                    <Col span={12}>
                      <Form.Select
                        field='user_group'
                        label={t('用户分组')}
                        placeholder={t('请选择用户分组')}
                        optionList={groupOptions}
                        style={{ width: '100%' }}
                      />
                    </Col>
                    <Col span={12}>
                      <Form.Input
                        field='remark'
                        label={t('备注')}
                        placeholder={t('可选，仅管理员可见')}
                        showClear
                      />
                    </Col>
                  </Row>
                </Card>

                <Card className='!rounded-2xl shadow-sm border-0'>
                  <div className='flex items-center mb-2'>
                    <Avatar
                      size='small'
                      color='green'
                      className='mr-2 shadow-md'
                    >
                      <IconKey size={16} />
                    </Avatar>
                    <div>
                      <Text className='text-lg font-medium'>
                        {t('默认令牌')}
                      </Text>
                      <div className='text-xs text-gray-600'>
                        {t('为临时账号同步开通默认令牌，可单独设置分组和额度。')}
                      </div>
                    </div>
                  </div>

                  <Row gutter={12}>
                    <Col span={12}>
                      <Form.Input
                        field='token_name'
                        label={t('令牌名称')}
                        placeholder='temporary-default'
                        showClear
                      />
                    </Col>
                    <Col span={12}>
                      <Form.Select
                        field='token_group'
                        label={t('令牌分组')}
                        placeholder={t('请选择令牌分组')}
                        optionList={tokenGroupOptions}
                        style={{ width: '100%' }}
                      />
                    </Col>
                    <Col span={12}>
                      <Form.DatePicker
                        field='token_expired_time'
                        label={t('令牌过期时间')}
                        type='dateTime'
                        placeholder={t('留空为永不过期')}
                        style={{ width: '100%' }}
                      />
                    </Col>
                    <Col span={12}>
                      <Form.InputNumber
                        field='token_remain_quota'
                        label={t('令牌剩余额度')}
                        min={0}
                        precision={quotaInputIsAmount ? 2 : 0}
                        step={quotaInputIsAmount ? 1 : 500000}
                        disabled={values.token_unlimited_quota !== false}
                        style={{ width: '100%' }}
                        extraText={
                          values.token_unlimited_quota !== false
                            ? t('已开启不限额，当前输入不会生效')
                            : quotaInputIsAmount
                              ? t('按当前显示金额输入，保存时会自动换算为系统额度')
                              : renderQuotaWithPrompt(
                                  Number(values.token_remain_quota || 0),
                                )
                        }
                      />
                    </Col>
                    <Col span={24}>
                      <Form.Checkbox field='token_unlimited_quota' noLabel>
                        {t('默认令牌不限额')}
                      </Form.Checkbox>
                    </Col>
                  </Row>
                </Card>
              </div>
            )}
          </Form>
        </Spin>
      </SideSheet>

      <Modal
        title={t('临时账号已创建')}
        visible={!!createdResult}
        onCancel={() => setCreatedResult(null)}
        footer={
          <Space>
            <Button
              onClick={() =>
                handleCopy(
                  createdResult?.default_token,
                  t('默认令牌已复制到剪贴板'),
                )
              }
            >
              {t('复制默认令牌')}
            </Button>
            <Button type='primary' onClick={() => setCreatedResult(null)}>
              {t('我已保存')}
            </Button>
          </Space>
        }
        centered
        width={isMobile ? '100%' : 720}
      >
        {createdResult ? (
          <div className='flex flex-col gap-3'>
            <Descriptions>
              <Descriptions.Item itemKey={t('用户名')}>
                <Space>
                  <Text>{createdResult.username}</Text>
                  <Button
                    size='small'
                    type='tertiary'
                    onClick={() =>
                      handleCopy(
                        createdResult.username,
                        t('用户名已复制到剪贴板'),
                      )
                    }
                  >
                    {t('复制')}
                  </Button>
                </Space>
              </Descriptions.Item>
              <Descriptions.Item itemKey={t('密码')}>
                <Space>
                  <Text>{createdResult.password}</Text>
                  <Button
                    size='small'
                    type='tertiary'
                    onClick={() =>
                      handleCopy(
                        createdResult.password,
                        t('密码已复制到剪贴板'),
                      )
                    }
                  >
                    {t('复制')}
                  </Button>
                </Space>
              </Descriptions.Item>
              <Descriptions.Item itemKey={t('默认令牌')}>
                <Space wrap>
                  <Text>{createdResult.default_token}</Text>
                  <Button
                    size='small'
                    type='tertiary'
                    onClick={() =>
                      handleCopy(
                        createdResult.default_token,
                        t('默认令牌已复制到剪贴板'),
                      )
                    }
                  >
                    {t('复制')}
                  </Button>
                </Space>
              </Descriptions.Item>
              <Descriptions.Item itemKey={t('用户分组')}>
                {createdResult.group}
              </Descriptions.Item>
              <Descriptions.Item itemKey={t('令牌分组')}>
                {createdResult.token_group}
              </Descriptions.Item>
              <Descriptions.Item itemKey={t('初始余额')}>
                {renderQuota(Number(createdResult.quota || 0))}
              </Descriptions.Item>
            </Descriptions>
            <Text type='warning'>
              {t('请立即保存账号密码和默认令牌，关闭后将不再展示完整令牌。')}
            </Text>
          </div>
        ) : null}
      </Modal>
    </>
  );
};

export default TemporaryUsersSetting;
