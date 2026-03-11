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
import { Button, Card, Tabs, Tag } from '@douyinfe/semi-ui';
import { IconArrowRight, IconDelete } from '@douyinfe/semi-icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import UsageLogsPage from '../table/usage-logs';
import TaskLogsPage from '../table/task-logs';
import MjLogsPage from '../table/mj-logs';
import PortalStateBlock from './PortalStateBlock';

const TAB_LABELS = {
  api: 'API 日志',
  task: '任务日志',
  image: '图像日志',
};

const getTabGuide = (activeTab, t) => {
  if (activeTab === 'task') {
    return [
      {
        title: t('聚焦任务追踪'),
        description: t('适合排查异步任务提交、处理进度、失败原因和结果链接。'),
      },
      {
        title: t('详情查看方式'),
        description: t('点击内容列或结果列即可打开现有详情弹层与音视频预览。'),
      },
      {
        title: t('联动建议'),
        description: t(
          '从总览跳来时会保留时间范围，你可以继续补充 task id 做精确排查。',
        ),
      },
    ];
  }

  if (activeTab === 'image') {
    return [
      {
        title: t('聚焦图像任务'),
        description: t(
          '适合排查 Midjourney 等图像相关任务的提交结果、进度和失败原因。',
        ),
      },
      {
        title: t('详情查看方式'),
        description: t(
          '点击图片、提示词和失败原因列可以打开现有预览或文本详情。',
        ),
      },
      {
        title: t('联动建议'),
        description: t(
          '带着时间范围进入后，可以继续输入 mj id 快速缩小排查面。',
        ),
      },
    ];
  }

  return [
    {
      title: t('聚焦 API 调用'),
      description: t('适合排查模型、分组、请求 ID、消耗额度与计费来源。'),
    },
    {
      title: t('详情查看方式'),
      description: t(
        '点击行可展开追踪详情，包含时间、模型、额度、计费来源与错误信息。',
      ),
    },
    {
      title: t('联动建议'),
      description: t(
        '从总览和分析页跳转时会自动带上时间范围、模型名或请求 ID。',
      ),
    },
  ];
};

const PortalLogsPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
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

  const metricCards = useMemo(
    () => [
      {
        key: 'tab',
        label: t('当前日志视图'),
        value: t(TAB_LABELS[activeTab]),
        hint: t('在统一门户内切换 API、任务与图像日志'),
      },
      {
        key: 'filters',
        label: t('联动条件数'),
        value: `${linkedFilters.length}`,
        hint: linkedFilters.length
          ? t('这些条件会在门户日志中心中继续生效')
          : t('当前没有来自其他页面的联动条件'),
      },
      {
        key: 'detail',
        label: t('详情方式'),
        value: activeTab === 'api' ? t('展开行详情') : t('模态详情'),
        hint: t('沿用现有日志明细能力，保证排查路径连续'),
      },
      {
        key: 'scope',
        label: t('排查焦点'),
        value:
          activeTab === 'api'
            ? t('调用与计费')
            : activeTab === 'task'
              ? t('异步任务')
              : t('图像生成'),
        hint: t('切换标签时保留门户级入口与说明结构'),
      },
    ],
    [activeTab, linkedFilters.length, t],
  );

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
      <Card
        className='portal-panel portal-overview__hero portal-logs__hero'
        bordered={false}
      >
        <div className='portal-overview__hero-content'>
          <div>
            <div className='portal-overview__eyebrow'>{t('日志中心')}</div>
            <h1 className='portal-overview__hero-title'>
              {t('统一查看 API、任务与图像日志')}
            </h1>
            <p className='portal-overview__hero-description'>
              {t(
                '客户门户日志中心保留一致的布局、联动条件与查看路径，帮助你在同一入口里完成调用排查、任务追踪和图像结果核对。',
              )}
            </p>
          </div>
          <div className='portal-overview__hero-actions'>
            <Button
              theme='light'
              type='primary'
              icon={<IconArrowRight />}
              onClick={() => navigate('/app/overview')}
            >
              {t('返回总览')}
            </Button>
            <Button
              theme='light'
              type='tertiary'
              icon={<IconArrowRight />}
              onClick={() => navigate('/app/models')}
            >
              {t('查看模型广场')}
            </Button>
            <Button
              theme='borderless'
              type='tertiary'
              icon={<IconDelete />}
              onClick={handleClearLinkedFilters}
            >
              {t('清空联动条件')}
            </Button>
          </div>
        </div>
        <div className='portal-overview__hero-side'>
          <div className='portal-overview__hero-kpi'>
            <span>{t('当前入口')}</span>
            <strong>{t(TAB_LABELS[activeTab])}</strong>
            <small>{t('保持一致的门户导航、筛选承接与排查说明')}</small>
          </div>
          <div className='portal-overview__hero-kpi'>
            <span>{t('已带入条件')}</span>
            <strong>{linkedFilters.length}</strong>
            <small>
              {linkedFilters.length
                ? t('切换标签后仍会保留这些 URL 条件')
                : t('从总览或模型页跳转时，这里会展示联动筛选')}
            </small>
          </div>
        </div>
      </Card>

      <div className='portal-overview__metrics portal-logs__metrics'>
        {metricCards.map((item) => (
          <Card
            key={item.key}
            className='portal-panel portal-overview__metric'
            bordered={false}
          >
            <span className='portal-overview__metric-label'>{item.label}</span>
            <strong className='portal-overview__metric-value'>
              {item.value}
            </strong>
            <small className='portal-overview__metric-hint'>{item.hint}</small>
          </Card>
        ))}
      </div>

      <div className='portal-logs__content'>
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

        <div className='portal-logs__side'>
          <Card
            className='portal-panel portal-detail-panel portal-logs__side-card'
            bordered={false}
          >
            <div className='portal-overview__section-head'>
              <div>
                <div className='portal-overview__eyebrow'>{t('联动筛选')}</div>
                <h2>{t('当前承接的上下文条件')}</h2>
              </div>
              <Tag color='violet' shape='circle'>
                {t('{{count}} 个条件', { count: linkedFilters.length })}
              </Tag>
            </div>
            {linkedFilters.length ? (
              <div className='portal-logs__filter-list'>
                {linkedFilters.map((filter) => (
                  <div className='portal-logs__filter-item' key={filter.key}>
                    <span>{filter.label}</span>
                    <strong>{filter.value}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <PortalStateBlock
                compact
                contained={false}
                title={t('当前没有联动条件')}
                description={t(
                  '从总览、分析页或模型详情进入时，这里会展示自动带入的时间范围、模型名或请求 ID。',
                )}
              />
            )}
          </Card>

          <Card
            className='portal-panel portal-detail-panel portal-logs__side-card'
            bordered={false}
          >
            <div className='portal-overview__section-head'>
              <div>
                <div className='portal-overview__eyebrow'>{t('查看说明')}</div>
                <h2>
                  {t('{{tab}} 的排查路径', { tab: t(TAB_LABELS[activeTab]) })}
                </h2>
              </div>
            </div>
            <div className='portal-logs__guide-list'>
              {getTabGuide(activeTab, t).map((item) => (
                <div className='portal-logs__guide-item' key={item.title}>
                  <strong>{item.title}</strong>
                  <p>{item.description}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PortalLogsPage;
