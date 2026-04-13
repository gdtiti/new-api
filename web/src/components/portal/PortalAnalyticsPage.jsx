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
import { Button, Card } from '@douyinfe/semi-ui';
import { IconArrowRight, IconBolt, IconHistogram } from '@douyinfe/semi-icons';
import { VChart } from '@visactor/react-vchart';
import { useTranslation } from 'react-i18next';
import { useOutletContext } from 'react-router-dom';
import { CHART_CONFIG } from '../../constants/dashboard.constants';
import { usePortalOverviewData } from '../../hooks/portal/usePortalOverviewData';
import PortalTimeRangeBar from './PortalTimeRangeBar';
import PortalStateBlock from './PortalStateBlock';
import { getPortalChartDisplaySpec } from './portalSkin';

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
              <strong>{modelName}</strong>
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

const PortalAnalyticsPage = () => {
  const { t } = useTranslation();
  const { portalSkinKey } = useOutletContext() || {};
  const overview = usePortalOverviewData(portalSkinKey);

  const quotaChartSpec = useMemo(
    () => getPortalChartDisplaySpec(overview.specLine, { variant: 'bar' }),
    [overview.specLine],
  );
  const trendChartSpec = useMemo(
    () => getPortalChartDisplaySpec(overview.specModelLine, { variant: 'line' }),
    [overview.specModelLine],
  );

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
  const analyticsMetricCards = overview.analyticsMetricCards.slice(0, 4);
  const showRequestRanking = (overview.requestRanking?.length || 0) > 0;
  const showQuotaRanking = (overview.quotaRanking?.length || 0) > 0;
  const showInsights = (overview.insights?.length || 0) > 0;
  const showSecondarySections =
    showRequestRanking || showQuotaRanking || showInsights;
  const hasQuotaChartData = overview.lineData.some(
    (item) => Number(item.rawQuota || 0) > 0,
  );
  const trendSeriesData = overview.specModelLine?.data?.[0]?.values || [];
  const hasTrendChartData = trendSeriesData.some(
    (item) => Number(item.Count || 0) > 0,
  );

  const headChips = [
    {
      key: 'window',
      label: t('统计窗口'),
      value: activeWindowLabel,
    },
    {
      key: 'granularity',
      label: t('粒度'),
      value: overview.defaultTime || t('自定义'),
    },
    {
      key: 'focus',
      label: t('重点模型'),
      value: focusModel || t('暂无'),
    },
  ];

  const chartCards = [
    {
      key: 'quota-distribution',
      eyebrow: t('消耗结构'),
      title: t('模型消耗分布'),
      spec: quotaChartSpec,
      hasData: hasQuotaChartData,
      emptyTitle: t('当前窗口暂无消耗数据'),
      emptyDescription: t('真实调用产生后，这里会展示模型消耗分布。'),
      actionLabel: topQuotaModel ? t('查看模型') : t('查看日志'),
      onAction: () =>
        topQuotaModel
          ? overview.navigateToModel(topQuotaModel)
          : overview.navigateToLogs(),
    },
    {
      key: 'quota-trend',
      eyebrow: t('趋势'),
      title: t('模型消耗趋势'),
      spec: trendChartSpec,
      hasData: hasTrendChartData,
      emptyTitle: t('当前窗口暂无趋势数据'),
      emptyDescription: t('先切换时间范围，或回到日志页产生调用后再查看。'),
      actionLabel: focusModel ? t('查看日志') : t('完整日志'),
      onAction: () =>
        overview.navigateToLogs(
          focusModel ? { model_name: focusModel } : {},
        ),
    },
  ];
  const visibleChartCards = chartCards.filter((item) => item.hasData);
  const hasAnyChartData = visibleChartCards.length > 0;
  const showHeadPrimaryAction = hasAnyChartData || showSecondarySections;
  const analyticsWorkspaceClassName = `portal-analytics__workspace${showSecondarySections ? '' : ' portal-analytics__workspace--single'}`;
  const analyticsFlowItems = [
    {
      key: 'logs',
      label: t('1. 产生日志'),
      value: t('先去日志页发起真实调用'),
    },
    {
      key: 'window',
      label: t('2. 选时间范围'),
      value: activeWindowLabel,
    },
    {
      key: 'return',
      label: t('3. 回来看分析'),
      value: t('趋势、模型分布和排行会显示在这里'),
    },
  ];

  return (
    <div className='portal-page portal-analytics'>
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
          <div className='portal-page-head__eyebrow'>{t('数据分析')}</div>
          <h1 className='portal-page-head__title'>{t('模型与调用分析')}</h1>
          <div className='portal-overview__meta-chips'>
            {headChips.map((item) => (
              <span key={item.key} className='portal-overview__meta-chip'>
                <strong>{item.label}</strong>
                <span>{item.value}</span>
              </span>
            ))}
          </div>
        </div>
        <div className='portal-page-head__actions'>
          {showHeadPrimaryAction ? (
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
              {focusModel ? t('查看重点模型日志') : t('打开日志')}
            </Button>
          ) : null}
          {topQuotaModel && showHeadPrimaryAction ? (
            <Button
              theme='borderless'
              type='tertiary'
              icon={<IconHistogram />}
              onClick={() =>
                topQuotaModel
                  ? overview.navigateToModel(topQuotaModel)
                  : overview.navigateToLogs()
              }
            >
              {topQuotaModel ? t('查看重点模型') : t('查看完整日志')}
            </Button>
          ) : null}
        </div>
      </div>

      <div className='portal-page-highlights portal-page-highlights--compact'>
        {analyticsMetricCards.map((item) => (
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

      <div className={analyticsWorkspaceClassName}>
        <div className='portal-analytics__chart-stack'>
          {hasAnyChartData ? (
            visibleChartCards.map((item) => (
              <Card
                key={item.key}
                className='portal-panel portal-analytics__chart-card'
                bordered={false}
              >
                <div className='portal-analytics__section-head'>
                  <div>
                    <div className='portal-overview__eyebrow'>{item.eyebrow}</div>
                    <h2>{item.title}</h2>
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
                    style={{ width: '100%', height: '320px' }}
                  />
                </div>
              </Card>
            ))
          ) : (
            <Card
              className='portal-panel portal-analytics__chart-card portal-analytics__chart-card--empty'
              bordered={false}
            >
              <div className='portal-analytics__section-head'>
                <div>
                  <div className='portal-overview__eyebrow'>{t('分析工作区')}</div>
                  <h2>{t('当前窗口暂无可分析数据')}</h2>
                </div>
              </div>
              <div className='portal-analytics__empty-shell'>
                <div className='portal-analytics__empty-copy'>
                  <p className='portal-analytics__empty-description'>
                    {t(
                      '先去日志页发起真实请求，再回来查看模型趋势、消耗结构和时间窗口表现。',
                    )}
                  </p>
                  <div className='portal-analytics__empty-points'>
                    <div className='portal-analytics__empty-point'>
                      <span>{t('统计窗口')}</span>
                      <strong>{activeWindowLabel}</strong>
                    </div>
                    <div className='portal-analytics__empty-point'>
                      <span>{t('建议入口')}</span>
                      <strong>{t('查看日志')}</strong>
                    </div>
                  </div>
                </div>
                <div className='portal-analytics__empty-actions'>
                  <Button
                    theme='solid'
                    type='primary'
                    icon={<IconBolt />}
                    onClick={() => overview.navigateToLogs()}
                  >
                    {t('打开日志')}
                  </Button>
                  <Button
                    theme='light'
                    type='primary'
                    icon={<IconHistogram />}
                    onClick={overview.handleRefresh}
                  >
                    {t('刷新当前窗口')}
                  </Button>
                </div>
                <div className='portal-analytics__preview'>
                  <div className='portal-analytics__preview-chart'>
                    <div className='portal-analytics__preview-head'>
                      <span>{t('零数据预览')}</span>
                      <strong>{t('当前还没有真实调用，下面只是版面占位')}</strong>
                    </div>
                    <div className='portal-analytics__preview-grid'>
                      {[0, 1, 2, 3].map((index) => (
                        <span
                          key={`grid-${index}`}
                          className='portal-analytics__preview-grid-line'
                        />
                      ))}
                    </div>
                    <div className='portal-analytics__preview-axis'>
                      <span>{t('趋势')}</span>
                      <span>{t('排行')}</span>
                      <span>{t('窗口')}</span>
                    </div>
                  </div>
                  <div className='portal-analytics__preview-side'>
                    <div className='portal-analytics__preview-card'>
                      <span>{t('模型排行')}</span>
                      <strong>{t('真实调用后显示 Top 模型')}</strong>
                    </div>
                    <div className='portal-analytics__preview-card'>
                      <span>{t('窗口表现')}</span>
                      <strong>{t('有数据后再展示时间范围波动')}</strong>
                    </div>
                  </div>
                </div>
                <div className='portal-analytics__flow'>
                  {analyticsFlowItems.map((item) => (
                    <div key={item.key} className='portal-analytics__flow-step'>
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}
        </div>

        {showSecondarySections ? (
          <div className='portal-analytics__side-grid'>
            {showRequestRanking ? (
              <Card
                className='portal-panel portal-detail-panel portal-analytics__section-card'
                bordered={false}
              >
                <div className='portal-analytics__section-head'>
                  <div>
                    <div className='portal-overview__eyebrow'>
                      {t('高频模型')}
                    </div>
                    <h2>{t('按调用次数排序')}</h2>
                  </div>
                </div>
                {renderRankingList(
                  overview.requestRanking,
                  'Model',
                  'Count',
                  t('当前筛选窗口内还没有模型调用数据。'),
                  (modelName) =>
                    overview.navigateToLogs({ model_name: modelName }),
                  t,
                )}
              </Card>
            ) : null}

            {showQuotaRanking ? (
              <Card
                className='portal-panel portal-detail-panel portal-analytics__section-card'
                bordered={false}
              >
                <div className='portal-analytics__section-head'>
                  <div>
                    <div className='portal-overview__eyebrow'>
                      {t('高消耗模型')}
                    </div>
                    <h2>{t('按模型占比排序')}</h2>
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
            ) : null}

            {showInsights ? (
              <Card
                className='portal-panel portal-detail-panel portal-analytics__section-card'
                bordered={false}
              >
                <div className='portal-analytics__section-head'>
                  <div>
                    <div className='portal-overview__eyebrow'>{t('经营洞察')}</div>
                    <h2>{t('下一步动作')}</h2>
                  </div>
                </div>
                {renderInsightList(overview.insights.slice(0, 4), t)}
              </Card>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default PortalAnalyticsPage;
