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

import { Button, Card } from '@douyinfe/semi-ui';
import {
  IconArrowRight,
  IconBolt,
  IconCreditCard,
  IconHistogram,
  IconKey,
  IconList,
  IconPieChartStroked,
  IconPulse,
  IconSafe,
} from '@douyinfe/semi-icons';
import { VChart } from '@visactor/react-vchart';
import { useTranslation } from 'react-i18next';
import { useOutletContext } from 'react-router-dom';
import { CHART_CONFIG } from '../../constants/dashboard.constants';
import { usePortalOverviewData } from '../../hooks/portal/usePortalOverviewData';
import PortalTimeRangeBar from './PortalTimeRangeBar';
import PortalStateBlock from './PortalStateBlock';

const getQuickActionIcon = (key) => {
  if (key === 'tokens') {
    return <IconKey />;
  }
  if (key === 'wallet') {
    return <IconCreditCard />;
  }
  if (key === 'subscription') {
    return <IconSafe />;
  }
  if (key === 'logs') {
    return <IconBolt />;
  }
  return <IconPieChartStroked />;
};

const renderRankingList = (items, field, valueField, emptyText, onJump, t) => {
  if (!items.length) {
    return (
      <PortalStateBlock
        compact
        contained={false}
        title={t('暂无数据')}
        description={emptyText}
      />
    );
  }

  return (
    <div className='portal-analytics__ranking-list'>
      {items.map((item, index) => {
        const modelName = item[field];
        return (
          <button
            key={`${modelName}-${index}`}
            className='portal-analytics__ranking-item'
            onClick={() => onJump(modelName)}
          >
            <div className='portal-analytics__ranking-main'>
              <span className='portal-analytics__ranking-index'>
                {String(index + 1).padStart(2, '0')}
              </span>
              <div>
                <strong>{modelName}</strong>
                <small>{t('点击继续查看对应详情')}</small>
              </div>
            </div>
            <span className='portal-analytics__ranking-value'>
              {item[valueField]}
            </span>
          </button>
        );
      })}
    </div>
  );
};

const renderInsightList = (items, t) => {
  if (!items.length) {
    return (
      <PortalStateBlock
        compact
        contained={false}
        title={t('暂无经营提醒')}
        description={t('当前余额、订阅和模型使用都比较稳定。')}
      />
    );
  }

  return (
    <div className='portal-analytics__insight-list'>
      {items.map((item) => (
        <button
          key={item.key}
          className={`portal-analytics__insight portal-analytics__insight--${item.level}`}
          onClick={item.onClick}
        >
          <div>
            <strong>{item.title}</strong>
            <p>{item.description}</p>
          </div>
          <span>{item.actionLabel}</span>
        </button>
      ))}
    </div>
  );
};

const renderQuickActions = (actions) => {
  return (
    <div className='portal-analytics__actions'>
      {actions.map((item) => (
        <Card
          key={item.key}
          className='portal-panel portal-analytics__action'
          bordered={false}
        >
          <div className='portal-analytics__action-icon'>
            {getQuickActionIcon(item.key)}
          </div>
          <strong>{item.title}</strong>
          <p>{item.description}</p>
          <Button
            theme='light'
            type='primary'
            onClick={item.onClick}
            icon={<IconArrowRight />}
          >
            {item.actionLabel}
          </Button>
        </Card>
      ))}
    </div>
  );
};

const PortalAnalyticsPage = () => {
  const { t } = useTranslation();
  const { portalSkinKey } = useOutletContext() || {};
  const overview = usePortalOverviewData(portalSkinKey);

  if (overview.loading) {
    return (
      <PortalStateBlock
        type='loading'
        title={t('正在加载数据分析')}
        description={t('正在准备趋势、排行与模型分布数据。')}
      />
    );
  }

  if (overview.errorMessage && !overview.user) {
    return (
      <PortalStateBlock
        type='error'
        title={t('数据分析加载失败')}
        description={overview.errorMessage}
        onAction={overview.handleRefresh}
      />
    );
  }

  const topRequestModel = overview.requestRanking?.[0]?.Model || '';
  const topQuotaModel = overview.quotaRanking?.[0]?.type || '';
  const focusModel = topRequestModel || topQuotaModel;
  const activeWindowLabel = `${overview.dateRange?.[0] || '-'} ~ ${overview.dateRange?.[1] || '-'}`;
  const focusModelDescription = topRequestModel
    ? t('当前调用最频繁，适合继续查看日志明细。')
    : topQuotaModel
      ? t('当前消耗占比较高，适合继续查看模型详情。')
      : t('当有模型使用数据后，这里会自动突出重点。');

  const chartCards = [
    {
      key: 'quota-distribution',
      eyebrow: t('消耗结构'),
      title: t('模型消耗分布'),
      description: t('用统一时间窗口查看不同模型在当前阶段的消耗差异。'),
      icon: <IconHistogram />,
      spec: overview.specLine,
      actionLabel: t('查看模型页'),
      onAction: () => overview.navigateToModel(topQuotaModel),
      disabled: !topQuotaModel,
    },
    {
      key: 'quota-trend',
      eyebrow: t('趋势'),
      title: t('模型消耗趋势'),
      description: t('观察模型消耗随时间的变化，识别峰值和异常波动。'),
      icon: <IconPulse />,
      spec: overview.specModelLine,
      actionLabel: t('查看日志'),
      onAction: () =>
        overview.navigateToLogs(topRequestModel ? { model_name: topRequestModel } : {}),
      disabled: false,
    },
    {
      key: 'request-rank',
      eyebrow: t('调用排行'),
      title: t('调用次数分布'),
      description: t('快速定位当前时间窗口里最活跃的模型。'),
      icon: <IconList />,
      spec: overview.specRankBar,
      actionLabel: t('继续排查'),
      onAction: () =>
        overview.navigateToLogs(topRequestModel ? { model_name: topRequestModel } : {}),
      disabled: false,
    },
    {
      key: 'usage-share',
      eyebrow: t('占比'),
      title: t('调用占比结构'),
      description: t('用占比视角判断是否出现模型集中或结构失衡。'),
      icon: <IconPieChartStroked />,
      spec: overview.specPie,
      actionLabel: t('查看模型'),
      onAction: () => overview.navigateToModel(topQuotaModel),
      disabled: !topQuotaModel,
    },
  ];

  return (
    <div className='portal-analytics'>
      <PortalTimeRangeBar
        preset={overview.preset}
        presetOptions={overview.presetOptions}
        dateRange={overview.dateRange}
        defaultTime={overview.defaultTime}
        timeOptions={overview.timeOptions}
        refreshing={overview.refreshing}
        onPresetChange={overview.handlePresetChange}
        onDateRangeChange={overview.handleDateRangeChange}
        onDefaultTimeChange={overview.handleDefaultTimeChange}
        onRefresh={overview.handleRefresh}
      />

      <Card
        className='portal-panel portal-detail-panel portal-analytics__hero'
        bordered={false}
      >
        <div className='portal-analytics__hero-content'>
          <div>
            <div className='portal-overview__eyebrow'>{t('数据分析')}</div>
            <h1 className='portal-overview__hero-title'>
              {t('把趋势、排行和下一步动作放到同一个分析工作台')}
            </h1>
            <p className='portal-overview__hero-description'>
              {t(
                '这里延续门户统一筛选条件，把模型分布、调用趋势、重点排行和后续动作重新整理成更清晰的分析版面，方便直接继续排查和跳转。',
              )}
            </p>
          </div>
          <div className='portal-analytics__hero-actions'>
            <Button
              theme='solid'
              type='primary'
              icon={<IconBolt />}
              onClick={() =>
                overview.navigateToLogs(
                  focusModel ? { model_name: focusModel } : {},
                )
              }
            >
              {focusModel ? t('查看重点模型日志') : t('查看完整日志')}
            </Button>
            <Button
              theme='light'
              type='primary'
              icon={<IconArrowRight />}
              onClick={() => overview.navigateToModel(focusModel)}
            >
              {focusModel ? t('打开重点模型') : t('查看模型广场')}
            </Button>
          </div>
        </div>
        <div className='portal-analytics__hero-side'>
          <div className='portal-analytics__hero-kpi'>
            <span>{t('当前分析窗口')}</span>
            <strong>{activeWindowLabel}</strong>
            <small>
              {overview.defaultTime || t('按自定义时间范围统计')}
            </small>
          </div>
          <div className='portal-analytics__hero-kpi'>
            <span>{t('当前重点模型')}</span>
            <strong>{focusModel || t('暂无数据')}</strong>
            <small>{focusModelDescription}</small>
          </div>
        </div>
      </Card>

      <div className='portal-analytics__metrics'>
        {overview.analyticsMetricCards.map((item) => (
          <Card
            key={item.key}
            className='portal-panel portal-analytics__metric'
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

      <div className='portal-analytics__charts'>
        {chartCards.map((item) => (
          <Card
            key={item.key}
            className='portal-panel portal-detail-panel portal-analytics__chart-card'
            bordered={false}
          >
            <div className='portal-analytics__section-head'>
              <div>
                <div className='portal-overview__eyebrow'>
                  {item.icon}
                  {item.eyebrow}
                </div>
                <h2>{item.title}</h2>
                <p className='portal-analytics__section-description'>
                  {item.description}
                </p>
              </div>
              <Button
                theme='borderless'
                type='tertiary'
                icon={<IconArrowRight />}
                onClick={item.onAction}
                disabled={item.disabled}
              >
                {item.actionLabel}
              </Button>
            </div>
            <VChart
              spec={item.spec}
              option={CHART_CONFIG}
              style={{ width: '100%', height: '360px' }}
            />
          </Card>
        ))}
      </div>

      <div className='portal-analytics__content-grid'>
        <Card
          className='portal-panel portal-detail-panel portal-analytics__section-card'
          bordered={false}
        >
          <div className='portal-analytics__section-head'>
            <div>
              <div className='portal-overview__eyebrow'>{t('高频模型')}</div>
              <h2>{t('按调用次数排序')}</h2>
              <p className='portal-analytics__section-description'>
                {t('适合从最活跃的模型开始追查具体日志和调用来源。')}
              </p>
            </div>
          </div>
          {renderRankingList(
            overview.requestRanking,
            'Model',
            'Count',
            t('当前筛选窗口内还没有模型调用数据。'),
            (modelName) => overview.navigateToLogs({ model_name: modelName }),
            t,
          )}
        </Card>

        <Card
          className='portal-panel portal-detail-panel portal-analytics__section-card'
          bordered={false}
        >
          <div className='portal-analytics__section-head'>
            <div>
              <div className='portal-overview__eyebrow'>{t('高消耗模型')}</div>
              <h2>{t('按模型调用占比排序')}</h2>
              <p className='portal-analytics__section-description'>
                {t('适合先看占比较高的模型，判断是否需要切换或限制。')}
              </p>
            </div>
          </div>
          {renderRankingList(
            overview.quotaRanking,
            'type',
            'value',
            t('当前筛选窗口内还没有模型占比数据。'),
            (modelName) => overview.navigateToModel(modelName),
            t,
          )}
        </Card>
      </div>

      <div className='portal-analytics__content-grid'>
        <Card
          className='portal-panel portal-detail-panel portal-analytics__section-card'
          bordered={false}
        >
          <div className='portal-analytics__section-head'>
            <div>
              <div className='portal-overview__eyebrow'>{t('经营洞察')}</div>
              <h2>{t('现在最值得处理的事情')}</h2>
              <p className='portal-analytics__section-description'>
                {t('根据余额、订阅和模型使用情况，直接给出下一步动作。')}
              </p>
            </div>
          </div>
          {renderInsightList(overview.insights, t)}
        </Card>

        <Card
          className='portal-panel portal-detail-panel portal-analytics__section-card'
          bordered={false}
        >
          <div className='portal-analytics__section-head'>
            <div>
              <div className='portal-overview__eyebrow'>{t('下一步')}</div>
              <h2>{t('常用入口')}</h2>
              <p className='portal-analytics__section-description'>
                {t('保留门户常用操作，方便在分析后直接继续处理账户和日志。')}
              </p>
            </div>
          </div>
          {renderQuickActions(overview.quickActions)}
        </Card>
      </div>
    </div>
  );
};

export default PortalAnalyticsPage;
