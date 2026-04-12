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
  IconHistogram,
  IconPulse,
} from '@douyinfe/semi-icons';
import { VChart } from '@visactor/react-vchart';
import { useTranslation } from 'react-i18next';
import { useOutletContext } from 'react-router-dom';
import { CHART_CONFIG } from '../../constants/dashboard.constants';
import { usePortalOverviewData } from '../../hooks/portal/usePortalOverviewData';
import PortalTimeRangeBar from './PortalTimeRangeBar';
import PortalStateBlock from './PortalStateBlock';

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
  const focusModelDescription = focusModel
    ? t('重点模型：{{model}}', { model: focusModel })
    : t('当前窗口内还没有形成重点模型。');
  const headerDescription = t('当前窗口：{{window}} · 粒度：{{granularity}} · {{focus}}', {
    window: activeWindowLabel,
    granularity: overview.defaultTime || t('自定义'),
    focus: focusModelDescription,
  });
  const analyticsMetricCards = overview.analyticsMetricCards.slice(0, 3);
  const showRequestRanking = (overview.requestRanking?.length || 0) > 0;
  const showQuotaRanking = (overview.quotaRanking?.length || 0) > 0;
  const showInsights = (overview.insights?.length || 0) > 0;
  const showSecondarySections =
    showRequestRanking || showQuotaRanking || showInsights;

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

      <div className='portal-page-head'>
        <div className='portal-page-head__main'>
          <div className='portal-page-head__eyebrow'>{t('数据分析')}</div>
          <h1 className='portal-page-head__title'>
            {t('直接查看趋势、排行与重点模型')}
          </h1>
          <p className='portal-page-head__description'>
            {headerDescription}
          </p>
        </div>
        <div className='portal-page-head__actions'>
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
        </div>
      </div>

      <div className='portal-analytics__metrics'>
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

      {showSecondarySections ? (
        <>
          {(showRequestRanking || showQuotaRanking) ? (
            <div
              className={`portal-analytics__content-grid${showRequestRanking && showQuotaRanking ? '' : ' portal-analytics__content-grid--single'}`}
            >
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
              ) : null}
            </div>
          ) : null}

          {showInsights ? (
            <div className='portal-analytics__content-grid portal-analytics__content-grid--single'>
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
            </div>
          ) : null}
        </>
      ) : (
        <Card
          className='portal-panel portal-detail-panel portal-analytics__section-card'
          bordered={false}
        >
          <div className='portal-analytics__section-head'>
            <div>
              <div className='portal-overview__eyebrow'>{t('补充数据')}</div>
              <h2>{t('当前窗口还没有足够的统计结果')}</h2>
              <p className='portal-analytics__section-description'>
                {t('先切换时间范围，或到日志页产生真实调用后再回来查看。')}
              </p>
            </div>
          </div>
          <PortalStateBlock
            compact
            contained={false}
            title={t('暂无排行与经营提醒')}
            description={t('主图会优先保留，排行和提醒会在有真实数据后再展开。')}
          />
        </Card>
      )}
    </div>
  );
};

export default PortalAnalyticsPage;
