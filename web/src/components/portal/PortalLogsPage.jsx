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

import { useMemo } from 'react';
import { Button, Card, Tabs } from '@douyinfe/semi-ui';
import { IconDelete } from '@douyinfe/semi-icons';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import UsageLogsPage from '../table/usage-logs';
import TaskLogsPage from '../table/task-logs';
import MjLogsPage from '../table/mj-logs';
import PortalStateBlock from './PortalStateBlock';

const PortalLogsPage = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab = useMemo(() => {
    const nextTab = searchParams.get('tab');
    if (nextTab === 'task' || nextTab === 'image') {
      return nextTab;
    }
    return 'api';
  }, [searchParams]);

  const linkedFilters = useMemo(() => {
    const timeStart = searchParams.get('start_timestamp');
    const timeEnd = searchParams.get('end_timestamp');
    const filters = [];

    if (timeStart || timeEnd) {
      filters.push({
        key: 'time',
        label: t('时间范围'),
        value: `${timeStart || t('未设置')} ~ ${timeEnd || t('未设置')}`,
      });
    }
    if (searchParams.get('model_name')) {
      filters.push({
        key: 'model_name',
        label: t('模型'),
        value: searchParams.get('model_name'),
      });
    }
    if (searchParams.get('group')) {
      filters.push({
        key: 'group',
        label: t('分组'),
        value: searchParams.get('group'),
      });
    }
    if (searchParams.get('request_id')) {
      filters.push({
        key: 'request_id',
        label: 'Request ID',
        value: searchParams.get('request_id'),
      });
    }
    if (searchParams.get('task_id')) {
      filters.push({
        key: 'task_id',
        label: 'Task ID',
        value: searchParams.get('task_id'),
      });
    }
    if (searchParams.get('mj_id')) {
      filters.push({
        key: 'mj_id',
        label: 'MJ ID',
        value: searchParams.get('mj_id'),
      });
    }
    if (searchParams.get('logType')) {
      filters.push({
        key: 'log_type',
        label: t('日志类型'),
        value: searchParams.get('logType'),
      });
    }
    return filters;
  }, [searchParams, t]);

  const handleTabChange = (nextTab) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', nextTab);
    setSearchParams(next, { replace: true });
  };

  const handleClearLinkedFilters = () => {
    const next = new URLSearchParams();
    next.set('tab', activeTab);
    setSearchParams(next, { replace: true });
  };

  const renderLogPanel = () => {
    if (activeTab === 'task') {
      return <TaskLogsPage />;
    }
    if (activeTab === 'image') {
      return <MjLogsPage />;
    }
    return <UsageLogsPage />;
  };

  return (
    <div className='portal-overview portal-logs'>
      <div className='portal-page-head'>
        <div className='portal-page-head__main'>
          <div className='portal-page-head__eyebrow'>{t('日志中心')}</div>
          <h1 className='portal-page-head__title'>
            {t('日志筛选和结果列表优先展示')}
          </h1>
        </div>
        <div className='portal-page-head__actions'>
          {linkedFilters.length ? (
            <Button
              theme='borderless'
              type='tertiary'
              icon={<IconDelete />}
              onClick={handleClearLinkedFilters}
            >
              {t('清空联动条件')}
            </Button>
          ) : null}
        </div>
      </div>

      {linkedFilters.length ? (
        <Card
          className='portal-panel portal-detail-panel portal-logs__linked-card'
          bordered={false}
        >
          <div className='portal-logs__linked-header'>
            <div>
              <div className='portal-overview__eyebrow'>{t('联动筛选')}</div>
              <h2>{t('当前承接的上下文条件')}</h2>
            </div>
          </div>
          <div className='portal-logs__linked-filters'>
            {linkedFilters.map((filter) => (
              <div className='portal-logs__linked-filter' key={filter.key}>
                <span>{filter.label}</span>
                <strong>{filter.value}</strong>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <div
        className='portal-logs__content portal-logs__content--single'
      >
        <div className='portal-logs__main'>
          <Card className='portal-panel portal-logs__tabs' bordered={false}>
            <Tabs activeKey={activeTab} onChange={handleTabChange} type='card'>
              <Tabs.TabPane tab={t('API 日志')} itemKey='api'>
                {activeTab === 'api' ? renderLogPanel() : null}
              </Tabs.TabPane>
              <Tabs.TabPane tab={t('任务日志')} itemKey='task'>
                {activeTab === 'task' ? renderLogPanel() : null}
              </Tabs.TabPane>
              <Tabs.TabPane tab={t('图像日志')} itemKey='image'>
                {activeTab === 'image' ? renderLogPanel() : null}
              </Tabs.TabPane>
            </Tabs>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PortalLogsPage;
