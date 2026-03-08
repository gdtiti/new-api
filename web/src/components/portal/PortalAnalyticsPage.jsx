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

import { Button, Card, Empty, Tabs } from '@douyinfe/semi-ui';
import { IconArrowRight, IconHistogram, IconList, IconPulse } from '@douyinfe/semi-icons';
import { VChart } from '@visactor/react-vchart';
import { usePortalOverviewData } from '../../hooks/portal/usePortalOverviewData';
import PortalTimeRangeBar from './PortalTimeRangeBar';

const renderRankingList = (items, field, valueField, emptyText, onJump) => {
  if (!items.length) {
    return <Empty title='暂无数据' description={emptyText} />;
  }

  return (
    <div className='portal-overview__ranking-list'>
      {items.map((item, index) => {
        const modelName = item[field];
        return (
          <button key={`${modelName}-${index}`} className='portal-overview__ranking-item' onClick={() => onJump(modelName)}>
            <div>
              <span className='portal-overview__ranking-index'>{String(index + 1).padStart(2, '0')}</span>
              <strong>{modelName}</strong>
            </div>
            <span>{item[valueField]}</span>
          </button>
        );
      })}
    </div>
  );
};

const PortalAnalyticsPage = () => {
  const overview = usePortalOverviewData();

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

      <Card className='portal-panel portal-overview__hero portal-overview__hero--compact' bordered={false}>
        <div className='portal-overview__section-head'>
          <div>
            <div className='portal-overview__eyebrow'>数据分析</div>
            <h1 className='portal-overview__hero-title'>围绕当前时间范围的模型、消耗与调用分析</h1>
            <p className='portal-overview__hero-description'>
              分析页延续总览页的统一筛选条件，适合继续定位高消耗模型、验证模型占比和日志异常。
            </p>
          </div>
          <Button theme='light' type='primary' icon={<IconArrowRight />} onClick={() => overview.navigateToLogs()}>
            查看完整日志
          </Button>
        </div>
      </Card>

      <div className='portal-overview__metrics portal-overview__metrics--analytics'>
        {overview.analyticsMetricCards.map((item) => (
          <Card key={item.key} className='portal-panel portal-overview__metric' bordered={false}>
            <span className='portal-overview__metric-label'>{item.label}</span>
            <strong className='portal-overview__metric-value'>{item.value}</strong>
            <small className='portal-overview__metric-hint'>{item.hint}</small>
          </Card>
        ))}
      </div>

      <Card className='portal-panel portal-overview__chart-tabs' bordered={false}>
        <Tabs type='card'>
          <Tabs.TabPane tab={<span><IconHistogram /> 模型消耗分布</span>} itemKey='quota'>
            <VChart spec={overview.specLine} style={{ width: '100%', height: '420px' }} />
          </Tabs.TabPane>
          <Tabs.TabPane tab={<span><IconPulse /> 模型消耗趋势</span>} itemKey='trend'>
            <VChart spec={overview.specModelLine} style={{ width: '100%', height: '420px' }} />
          </Tabs.TabPane>
          <Tabs.TabPane tab={<span><IconList /> 调用次数排行</span>} itemKey='rank'>
            <VChart spec={overview.specRankBar} style={{ width: '100%', height: '420px' }} />
          </Tabs.TabPane>
          <Tabs.TabPane tab='调用占比结构' itemKey='pie'>
            <VChart spec={overview.specPie} style={{ width: '100%', height: '420px' }} />
          </Tabs.TabPane>
        </Tabs>
      </Card>

      <div className='portal-overview__rankings'>
        <Card className='portal-panel portal-overview__ranking' bordered={false}>
          <div className='portal-overview__section-head'>
            <div>
              <div className='portal-overview__eyebrow'>高消耗模型</div>
              <h2>按调用次数排序</h2>
            </div>
          </div>
          {renderRankingList(
            overview.requestRanking,
            'Model',
            'Count',
            '当前筛选窗口内还没有模型调用数据。',
            (modelName) => overview.navigateToLogs({ model_name: modelName }),
          )}
        </Card>
        <Card className='portal-panel portal-overview__ranking' bordered={false}>
          <div className='portal-overview__section-head'>
            <div>
              <div className='portal-overview__eyebrow'>高关注模型</div>
              <h2>按模型调用占比排序</h2>
            </div>
          </div>
          {renderRankingList(
            overview.quotaRanking,
            'type',
            'value',
            '当前筛选窗口内还没有模型占比数据。',
            (modelName) => overview.navigateToModel(modelName),
          )}
        </Card>
      </div>
    </div>
  );
};

export default PortalAnalyticsPage;
