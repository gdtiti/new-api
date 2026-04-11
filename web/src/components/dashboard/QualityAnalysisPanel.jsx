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

import React, { useMemo } from 'react';
import { Card, Table } from '@douyinfe/semi-ui';
import { VChart } from '@visactor/react-vchart';
import { Activity, Boxes } from 'lucide-react';

const formatPercent = (value) => `${Number(value || 0).toFixed(2)}%`;
const formatLatency = (value) => `${Number(value || 0).toFixed(2)}s`;

const SummaryMetric = ({ label, value }) => (
  <div className='rounded-xl border border-[var(--semi-color-border)] bg-[var(--semi-color-fill-0)] px-4 py-3'>
    <div className='text-xs text-[var(--semi-color-text-2)]'>{label}</div>
    <div className='mt-2 text-lg font-semibold text-[var(--semi-color-text-0)]'>
      {value}
    </div>
  </div>
);

const buildTrendSpec = (analytics, t) => {
  const values = (analytics?.trend || []).flatMap((item) => [
    {
      bucketLabel: item.bucket_label,
      metric: t('成功率'),
      value: Number(item.success_rate_percent || 0),
    },
    {
      bucketLabel: item.bucket_label,
      metric: t('错误率'),
      value: Number(item.error_rate_percent || 0),
    },
  ]);

  return {
    type: 'line',
    data: [{ id: 'trendData', values }],
    xField: 'bucketLabel',
    yField: 'value',
    seriesField: 'metric',
    title: {
      visible: true,
      text: t('稳定性趋势'),
    },
    axes: [
      { orient: 'bottom', type: 'band' },
      {
        orient: 'left',
        label: {
          formatMethod: (value) => `${value}%`,
        },
      },
    ],
    legends: { visible: true },
    tooltip: {
      mark: {
        content: [
          {
            key: (datum) => datum.metric,
            value: (datum) => `${Number(datum.value || 0).toFixed(2)}%`,
          },
        ],
      },
    },
  };
};

const buildRankingSpec = (analytics, t) => {
  const values = (analytics?.ranking || []).slice(0, 8).map((item) => ({
    label: item.label || t('未记录'),
    requests: Number(item.total_requests || 0),
  }));

  return {
    type: 'bar',
    data: [{ id: 'rankingData', values }],
    xField: 'label',
    yField: 'requests',
    seriesField: 'label',
    title: {
      visible: true,
      text: t('请求量排行'),
    },
    legends: { visible: false },
    bar: {
      state: {
        hover: {
          stroke: '#000',
          lineWidth: 1,
        },
      },
    },
    tooltip: {
      mark: {
        content: [
          {
            key: (datum) => datum.label,
            value: (datum) => `${datum.requests}`,
          },
        ],
      },
    },
  };
};

const QualityAnalysisPanel = ({
  title,
  analytics,
  loading,
  CARD_PROPS,
  CHART_CONFIG,
  t,
}) => {
  const summary = analytics?.summary || {};

  const columns = useMemo(
    () => [
      {
        title: t('名称'),
        dataIndex: 'label',
        render: (value) => value || t('未记录'),
      },
      {
        title: t('请求数'),
        dataIndex: 'total_requests',
      },
      {
        title: t('成功率'),
        dataIndex: 'success_rate_percent',
        render: (value) => formatPercent(value),
      },
      {
        title: t('平均时长'),
        dataIndex: 'avg_latency_seconds',
        render: (value) => formatLatency(value),
      },
      {
        title: t('P95 时长'),
        dataIndex: 'p95_latency_seconds',
        render: (value) => formatLatency(value),
      },
      {
        title: t('估算峰值并发'),
        dataIndex: 'peak_estimated_concurrency',
      },
      {
        title: t('稳定性评分'),
        dataIndex: 'stability_score',
        render: (value) => formatPercent(value),
      },
    ],
    [t],
  );

  const trendSpec = useMemo(() => buildTrendSpec(analytics, t), [analytics, t]);
  const rankingSpec = useMemo(
    () => buildRankingSpec(analytics, t),
    [analytics, t],
  );

  return (
    <Card
      {...CARD_PROPS}
      className='!rounded-2xl'
      title={
        <div className='flex items-center gap-2'>
          <Activity size={16} />
          {title}
        </div>
      }
      loading={loading}
    >
      <div className='grid grid-cols-2 xl:grid-cols-5 gap-3'>
        <SummaryMetric
          label={t('总请求数')}
          value={summary.total_requests || 0}
        />
        <SummaryMetric
          label={t('成功率')}
          value={formatPercent(summary.success_rate_percent)}
        />
        <SummaryMetric
          label={t('平均时长')}
          value={formatLatency(summary.avg_latency_seconds)}
        />
        <SummaryMetric
          label={t('估算峰值并发')}
          value={summary.peak_estimated_concurrency || 0}
        />
        <SummaryMetric
          label={t('稳定性评分')}
          value={formatPercent(summary.stability_score)}
        />
      </div>

      <div className='grid grid-cols-1 xl:grid-cols-2 gap-4 mt-4'>
        <div className='h-72'>
          <VChart spec={trendSpec} option={CHART_CONFIG} />
        </div>
        <div className='h-72'>
          <VChart spec={rankingSpec} option={CHART_CONFIG} />
        </div>
      </div>

      <div className='mt-4'>
        <div className='flex items-center gap-2 text-sm font-medium mb-3'>
          <Boxes size={16} />
          {t('明细排行')}
        </div>
        <Table
          size='small'
          columns={columns}
          dataSource={(analytics?.ranking || []).map((item, index) => ({
            key: item.key || `${index}`,
            ...item,
          }))}
          pagination={{ pageSize: 8 }}
        />
      </div>
    </Card>
  );
};

export default QualityAnalysisPanel;
