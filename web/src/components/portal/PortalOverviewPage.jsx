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

import { Button, Card, Empty, Progress, Skeleton } from '@douyinfe/semi-ui';
import { IconActivity, IconArrowRight, IconBolt, IconCreditCard, IconPieChartStroked, IconSafe } from '@douyinfe/semi-icons';
import { VChart } from '@visactor/react-vchart';
import { usePortalOverviewData } from '../../hooks/portal/usePortalOverviewData';
import PortalTimeRangeBar from './PortalTimeRangeBar';

const PortalOverviewPage = () => {
  const overview = usePortalOverviewData();

  if (overview.loading) {
    return (
      <div className='portal-overview'>
        <Skeleton placeholder={<Skeleton.Image style={{ width: '100%', height: 240 }} />} loading />
        <div className='portal-overview__metrics'>
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} placeholder={<Skeleton.Image style={{ width: '100%', height: 140 }} />} loading />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className='portal-overview'>
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

      <Card className='portal-panel portal-overview__hero' bordered={false}>
        <div className='portal-overview__hero-content'>
          <div>
            <div className='portal-overview__eyebrow'>客户总览</div>
            <h1 className='portal-overview__hero-title'>
              欢迎回来，{overview.user?.display_name || overview.user?.username || '客户'}
            </h1>
            <p className='portal-overview__hero-description'>
              这里汇总了你当前的余额、套餐、消耗趋势和风险提醒，帮助你更快做出下一步操作。
            </p>
          </div>
          <div className='portal-overview__hero-actions'>
            <Button theme='solid' type='primary' icon={<IconCreditCard />} onClick={overview.navigateToWallet}>
              钱包与额度
            </Button>
            <Button theme='light' type='tertiary' icon={<IconSafe />} onClick={overview.navigateToSubscription}>
              我的订阅
            </Button>
            <Button theme='borderless' type='tertiary' icon={<IconActivity />} onClick={overview.navigateToAnalytics}>
              查看分析
            </Button>
          </div>
        </div>
        <div className='portal-overview__hero-side'>
          <div className='portal-overview__hero-kpi'>
            <span>钱包余额</span>
            <strong>{overview.overviewMetricCards[0]?.value}</strong>
            <small>{overview.overviewMetricCards[0]?.hint}</small>
          </div>
          <div className='portal-overview__hero-kpi'>
            <span>当前扣费偏好</span>
            <strong>{overview.billingPreferenceLabel}</strong>
            <small>可在钱包或订阅中心继续调整</small>
          </div>
        </div>
      </Card>

      <div className='portal-overview__metrics'>
        {overview.overviewMetricCards.map((item) => (
          <Card key={item.key} className='portal-panel portal-overview__metric' bordered={false}>
            <span className='portal-overview__metric-label'>{item.label}</span>
            <strong className='portal-overview__metric-value'>{item.value}</strong>
            <small className='portal-overview__metric-hint'>{item.hint}</small>
          </Card>
        ))}
      </div>

      <div className='portal-overview__content-grid'>
        <Card className='portal-panel portal-overview__subscription' bordered={false}>
          <div className='portal-overview__section-head'>
            <div>
              <div className='portal-overview__eyebrow'>订阅状态</div>
              <h2>{overview.subscriptionTitle}</h2>
            </div>
            <Button theme='borderless' type='tertiary' icon={<IconArrowRight />} onClick={overview.navigateToSubscription}>
              查看详情
            </Button>
          </div>
          <Progress percent={overview.subscriptionUsagePercent} showInfo format={(percent) => `${percent}%`} stroke='#7c3aed' />
          <div className='portal-overview__subscription-meta'>
            <span>已用 {overview.subscriptionUsagePercent}%</span>
            <span>
              {overview.subscriptionRemainDays === null ? '未设置到期时间' : `预计剩余 ${overview.subscriptionRemainDays} 天`}
            </span>
          </div>
        </Card>

        <Card className='portal-panel portal-overview__insight-panel' bordered={false}>
          <div className='portal-overview__section-head'>
            <div>
              <div className='portal-overview__eyebrow'>经营洞察</div>
              <h2>现在最值得处理的事情</h2>
            </div>
          </div>
          <div className='portal-overview__insights'>
            {overview.insights.length === 0 ? (
              <Empty title='暂无风险提醒' description='当前余额、订阅和模型使用都比较健康。' />
            ) : (
              overview.insights.map((item) => (
                <button key={item.key} className={`portal-overview__insight portal-overview__insight--${item.level}`} onClick={item.onClick}>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.description}</p>
                  </div>
                  <span>{item.actionLabel}</span>
                </button>
              ))
            )}
          </div>
        </Card>
      </div>

      <div className='portal-overview__charts'>
        <Card className='portal-panel portal-overview__chart' bordered={false}>
          <div className='portal-overview__section-head'>
            <div>
              <div className='portal-overview__eyebrow'>趋势</div>
              <h2>模型消耗分布</h2>
            </div>
            <Button theme='borderless' type='tertiary' icon={<IconArrowRight />} onClick={overview.navigateToAnalytics}>
              查看完整分析
            </Button>
          </div>
          <VChart spec={overview.specLine} style={{ width: '100%', height: '360px' }} />
        </Card>
        <Card className='portal-panel portal-overview__chart' bordered={false}>
          <div className='portal-overview__section-head'>
            <div>
              <div className='portal-overview__eyebrow'>模型结构</div>
              <h2>调用次数占比</h2>
            </div>
          </div>
          <VChart spec={overview.specPie} style={{ width: '100%', height: '360px' }} />
        </Card>
      </div>

      <div className='portal-overview__quick-actions'>
        {overview.quickActions.map((item) => (
          <Card key={item.key} className='portal-panel portal-quick-action' bordered={false}>
            <div className='portal-quick-action__icon'>
              {item.key === 'wallet' ? <IconCreditCard /> : item.key === 'subscription' ? <IconSafe /> : item.key === 'logs' ? <IconBolt /> : <IconPieChartStroked />}
            </div>
            <strong>{item.title}</strong>
            <p>{item.description}</p>
            <Button theme='light' type='primary' onClick={item.onClick} icon={<IconArrowRight />}>
              {item.actionLabel}
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default PortalOverviewPage;
