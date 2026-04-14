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
import { Button, Card, Progress } from '@douyinfe/semi-ui';
import { useOutletContext } from 'react-router-dom';
import {
  IconActivity,
  IconArrowRight,
  IconCreditCard,
  IconKey,
  IconPieChartStroked,
  IconSafe,
} from '@douyinfe/semi-icons';
import { VChart } from '@visactor/react-vchart';
import { useTranslation } from 'react-i18next';
import { CHART_CONFIG } from '../../constants/dashboard.constants';
import { usePortalOverviewData } from '../../hooks/portal/usePortalOverviewData';
import PortalTimeRangeBar from './PortalTimeRangeBar';
import PortalStateBlock from './PortalStateBlock';
import { getPortalChartDisplaySpec } from './portalSkin';

const PortalOverviewPage = () => {
  const { t } = useTranslation();
  const { portalSkinKey } = useOutletContext() || {};
  const overview = usePortalOverviewData(portalSkinKey);

  const quotaChartSpec = useMemo(
    () => getPortalChartDisplaySpec(overview.specLine, { variant: 'bar' }),
    [overview.specLine],
  );
  const shareChartSpec = useMemo(
    () => getPortalChartDisplaySpec(overview.specPie, { variant: 'pie' }),
    [overview.specPie],
  );

  if (overview.loading) {
    return (
      <PortalStateBlock
        type='loading'
        title={t('正在加载客户总览')}
        description={t('正在准备余额、套餐与模型趋势数据。')}
      />
    );
  }

  if (overview.errorMessage && !overview.user) {
    return (
      <PortalStateBlock
        type='error'
        title={t('客户总览加载失败')}
        description={overview.errorMessage}
        onAction={overview.handleRefresh}
      />
    );
  }

  const userName =
    overview.user?.display_name || overview.user?.username || t('客户');
  const topQuotaModel = overview.quotaRanking?.[0]?.type || '';
  const topRequestModel = overview.requestRanking?.[0]?.Model || '';
  const walletMetric = overview.overviewMetricCards.find(
    (item) => item.key === 'wallet',
  );
  const requestMetric = overview.overviewMetricCards.find(
    (item) => item.key === 'requests',
  );
  const activeWindowLabel = `${overview.dateRange?.[0] || '-'} ~ ${overview.dateRange?.[1] || '-'}`;
  const hasQuotaChartData = overview.lineData.some(
    (item) => Number(item.rawQuota || 0) > 0,
  );
  const hasShareChartData = overview.pieData.some(
    (item) => Number(item.value || 0) > 0,
  );
  const insightItems = overview.insights.slice(0, 3);
  const hasInsightItems = insightItems.length > 0;

  const overviewChips = [
    {
      key: 'window',
      label: t('统计窗口'),
      value: activeWindowLabel,
    },
    {
      key: 'billing',
      label: t('扣费策略'),
      value: overview.billingPreferenceLabel,
    },
    {
      key: 'quota-model',
      label: t('重点消耗'),
      value: topQuotaModel || t('暂无'),
    },
  ];
  const chartCards = [
    {
      key: 'quota',
      eyebrow: t('消耗分布'),
      title: t('模型消耗分布'),
      hasData: hasQuotaChartData,
      spec: quotaChartSpec,
      actionLabel: topQuotaModel ? t('查看模型') : t('查看分析'),
      onAction: () =>
        topQuotaModel
          ? overview.navigateToModel(topQuotaModel)
          : overview.navigateToAnalytics(),
    },
    {
      key: 'share',
      eyebrow: t('调用结构'),
      title: t('调用次数占比'),
      hasData: hasShareChartData,
      spec: shareChartSpec,
      actionLabel: topRequestModel ? t('查看日志') : t('查看分析'),
      onAction: () =>
        topRequestModel
          ? overview.navigateToLogs({ model_name: topRequestModel })
          : overview.navigateToAnalytics(),
    },
  ];
  const visibleChartCards = chartCards.filter((item) => item.hasData);
  const hasAnyChartData = visibleChartCards.length > 0;
  const nextActionCards = [
    {
      key: 'subscription',
      step: '01',
      label: t('先处理订阅'),
      value: overview.subscriptionUsagePercent > 0 ? t('查看套餐详情') : t('开通套餐'),
      description:
        overview.subscriptionUsagePercent > 0
          ? t('确认剩余额度和续费状态')
          : t('先完成套餐开通'),
    },
    {
      key: 'token',
      step: '02',
      label: t('准备调用'),
      value: t('令牌中心'),
      description: t('创建或检查调用令牌'),
    },
    {
      key: 'logs',
      step: '03',
      label: t('查看结果'),
      value: t('查看日志'),
      description: t('回来看模型消耗和占比'),
    },
  ];
  const overviewPrimaryAction = overview.subscriptionUsagePercent > 0
    ? {
        label: t('去生成令牌'),
        onClick: overview.navigateToTokens,
      }
    : {
        label: t('去选套餐'),
        onClick: overview.navigateToSubscription,
      };

  return (
    <div className='portal-page portal-overview'>
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

      <div className='portal-page-head'>
        <div className='portal-page-head__main'>
          <div className='portal-page-head__eyebrow'>{t('客户总览')}</div>
          <h1 className='portal-page-head__title'>
            {t('欢迎，{{name}}', { name: userName })}
          </h1>
          <div className='portal-overview__meta-chips'>
            {overviewChips.map((item) => (
              <span key={item.key} className='portal-overview__meta-chip'>
                <strong>{item.label}</strong>
                <span>{item.value}</span>
              </span>
            ))}
          </div>
        </div>
        <div className='portal-page-head__actions'>
          <Button
            theme='solid'
            type='primary'
            icon={<IconKey />}
            size='small'
            onClick={overview.navigateToTokens}
          >
            {t('令牌中心')}
          </Button>
          {hasAnyChartData ? (
            <Button
              theme='light'
              type='primary'
              icon={<IconActivity />}
              size='small'
              onClick={overview.navigateToAnalytics}
            >
              {t('数据分析')}
            </Button>
          ) : null}
        </div>
      </div>

      <div className='portal-page-highlights'>
        {overview.overviewMetricCards.map((item) => (
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

      <div className='portal-overview__workspace'>
        <div className='portal-overview__sidebar'>
          <Card
            className='portal-panel portal-overview__subscription portal-overview__summary-card'
            bordered={false}
          >
            <div className='portal-overview__section-head'>
              <div>
                <div className='portal-overview__eyebrow'>{t('订阅与额度')}</div>
                <h2>{overview.subscriptionTitle}</h2>
              </div>
              <Button
                theme='borderless'
                type='tertiary'
                icon={<IconSafe />}
                onClick={overview.navigateToSubscription}
              >
                {t('我的订阅')}
              </Button>
            </div>
            <p className='portal-overview__summary-note'>
              {t('当前以 {{mode}} 方式结算。', {
                mode: overview.billingPreferenceLabel,
              })}
            </p>
            {overview.subscriptionUsagePercent > 0 ? (
              <>
                <Progress
                  percent={overview.subscriptionUsagePercent}
                  showInfo
                  format={(percent) => `${percent}%`}
                  stroke='var(--portal-accent)'
                />
                <div className='portal-overview__subscription-meta'>
                  <span>
                    {t('已用 {{percent}}%', {
                      percent: overview.subscriptionUsagePercent,
                    })}
                  </span>
                  <span>
                    {overview.subscriptionRemainDays === null
                      ? t('未设置到期时间')
                      : t('预计剩余 {{days}} 天', {
                          days: overview.subscriptionRemainDays,
                        })}
                  </span>
                </div>
              </>
            ) : (
              <div className='portal-overview__empty-inline'>
                <strong>{t('待开通')}</strong>
                <span>
                  {t('当前没有生效中的订阅套餐，可直接前往订阅中心开通。')}
                </span>
              </div>
            )}
            <div className='portal-overview__summary-grid'>
              <div className='portal-overview__summary-item'>
                <span>{walletMetric?.label || t('钱包余额')}</span>
                <strong>{walletMetric?.value || t('暂无')}</strong>
                <small>{walletMetric?.hint}</small>
              </div>
              <div className='portal-overview__summary-item'>
                <span>{requestMetric?.label || t('总调用次数')}</span>
                <strong>{requestMetric?.value || t('暂无')}</strong>
                <small>{requestMetric?.hint}</small>
              </div>
            </div>
            <div className='portal-overview__inline-actions'>
              <Button
                theme='light'
                type='primary'
                icon={<IconCreditCard />}
                onClick={overview.navigateToWallet}
              >
                {t('钱包与额度')}
              </Button>
              <Button
                theme='borderless'
                type='tertiary'
                icon={<IconArrowRight />}
                onClick={overview.navigateToSubscription}
              >
                {t('查看套餐详情')}
              </Button>
            </div>
          </Card>

          {hasInsightItems ? (
            <Card
              className='portal-panel portal-detail-panel portal-overview__insight-panel'
              bordered={false}
            >
              <div className='portal-overview__section-head'>
                <div>
                  <div className='portal-overview__eyebrow'>{t('待处理')}</div>
                  <h2>{t('本窗口需要关注的事项')}</h2>
                </div>
              </div>
              <div className='portal-overview__insights'>
                {insightItems.map((item) => (
                  <button
                    key={item.key}
                    className={`portal-overview__insight portal-overview__insight--${item.level}`}
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
            </Card>
          ) : null}
        </div>

        <Card
          className={`portal-panel portal-overview__chart-stage${hasAnyChartData ? '' : ' portal-overview__chart-stage--empty'}`}
          bordered={false}
        >
          <div className='portal-overview__chart-stage-head'>
            <div>
              <div className='portal-overview__eyebrow'>{t('模型分析')}</div>
              <h2>
                {hasAnyChartData
                  ? t('围绕当前窗口的模型变化')
                  : t('当前窗口还没有可读的模型趋势')}
              </h2>
            </div>
            <div className='portal-overview__chart-stage-actions'>
              <Button
                theme='light'
                type='primary'
                icon={<IconPieChartStroked />}
                onClick={overview.navigateToAnalytics}
              >
                {t('打开分析工作区')}
              </Button>
            </div>
          </div>

          {hasAnyChartData ? (
            <div className='portal-overview__chart-stage-metrics'>
              <div className='portal-overview__stage-metric'>
                <span>{t('重点消耗模型')}</span>
                <strong>{topQuotaModel || t('暂无')}</strong>
              </div>
              <div className='portal-overview__stage-metric'>
                <span>{t('重点调用模型')}</span>
                <strong>{topRequestModel || t('暂无')}</strong>
              </div>
              <div className='portal-overview__stage-metric'>
                <span>{t('分析窗口')}</span>
                <strong>{activeWindowLabel}</strong>
              </div>
            </div>
          ) : null}

          {hasAnyChartData ? (
            <div
              className={`portal-overview__chart-grid${visibleChartCards.length === 1 ? ' portal-overview__chart-grid--single' : ''}`}
            >
              {visibleChartCards.map((item) => (
                <div key={item.key} className='portal-overview__chart-card'>
                  <div className='portal-overview__chart-card-head'>
                    <div>
                      <div className='portal-overview__eyebrow'>{item.eyebrow}</div>
                      <h3>{item.title}</h3>
                    </div>
                    <Button
                      theme='borderless'
                      type='tertiary'
                      icon={<IconArrowRight />}
                      onClick={item.onAction}
                    >
                      {item.actionLabel}
                    </Button>
                  </div>
                  <div className='portal-overview__chart-canvas'>
                    <VChart
                      spec={item.spec}
                      option={CHART_CONFIG}
                      style={{ width: '100%', height: '316px' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className='portal-overview__chart-empty-shell'>
              <div className='portal-overview__chart-empty-copy'>
                <p className='portal-overview__chart-empty-description'>
                  {t(
                    '先到日志页产生一笔真实调用，再回来看模型消耗分布和调用占比。',
                  )}
                </p>
                <div className='portal-overview__chart-empty-points'>
                  <div className='portal-overview__empty-point'>
                    <span>{t('统计窗口')}</span>
                    <strong>{activeWindowLabel}</strong>
                  </div>
                  <div className='portal-overview__empty-point'>
                    <span>{t('建议下一步')}</span>
                    <strong>{t('查看日志并发起一次调用')}</strong>
                  </div>
                </div>
              </div>
              <div className='portal-overview__chart-empty-actions'>
                <Button
                  theme='light'
                  type='primary'
                  icon={<IconArrowRight />}
                  onClick={() => overview.navigateToLogs()}
                >
                  {t('查看日志')}
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>

      {!hasAnyChartData ? (
        <div className='portal-overview__task-strip'>
          <div className='portal-overview__task-rail'>
            {nextActionCards.map((item) => (
              <div key={item.key} className='portal-overview__task-card'>
                <div className='portal-overview__task-step'>{item.step}</div>
                <span className='portal-overview__task-label'>{item.label}</span>
                <strong>{item.value}</strong>
                <p>{item.description}</p>
              </div>
            ))}
          </div>
          <div className='portal-overview__task-card portal-overview__task-card--action'>
            <span className='portal-overview__task-label'>{t('当前主动作')}</span>
            <strong>{overviewPrimaryAction.label}</strong>
            <p>{t('完成后总览会自动切换到真实分析数据。')}</p>
            <Button
              theme='solid'
              type='primary'
              icon={<IconArrowRight />}
              onClick={overviewPrimaryAction.onClick}
            >
              {overviewPrimaryAction.label}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default PortalOverviewPage;
