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
import { Button, DatePicker, Select } from '@douyinfe/semi-ui';
import { IconRefresh } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { timestamp2string, toLocalUnixMilliseconds } from '../../helpers';

const normalizeDatePickerValue = (dateRange) => {
  if (!Array.isArray(dateRange) || dateRange.length !== 2) {
    return [];
  }

  const nextValue = dateRange
    .map((item) => {
      if (item instanceof Date && !Number.isNaN(item.getTime())) {
        return item;
      }

      const milliseconds = toLocalUnixMilliseconds(item);
      if (!Number.isFinite(milliseconds) || milliseconds <= 0) {
        return null;
      }

      const nextDate = new Date(milliseconds);
      return Number.isNaN(nextDate.getTime()) ? null : nextDate;
    })
    .filter(Boolean);

  return nextValue.length === 2 ? nextValue : [];
};

const normalizeChangeResult = (value, valueString) => {
  if (
    Array.isArray(valueString) &&
    valueString.length === 2 &&
    valueString.every(Boolean)
  ) {
    return valueString;
  }

  if (!Array.isArray(value) || value.length !== 2) {
    return value;
  }

  return value.map((item) => {
    if (item instanceof Date && !Number.isNaN(item.getTime())) {
      return timestamp2string(Math.floor(item.getTime() / 1000));
    }
    return item;
  });
};

const PortalTimeRangeBar = ({
  preset,
  presetOptions,
  dateRange,
  defaultTime,
  timeOptions,
  refreshing,
  onPresetChange,
  onDateRangeChange,
  onDefaultTimeChange,
  onRefresh,
}) => {
  const { t } = useTranslation();
  const pickerValue = useMemo(
    () => normalizeDatePickerValue(dateRange),
    [dateRange],
  );

  return (
    <div className='portal-panel portal-range-bar'>
      <div className='portal-range-bar__presets'>
        {presetOptions.map((item) => (
          <Button
            key={item.key}
            theme={preset === item.key ? 'solid' : 'borderless'}
            type={preset === item.key ? 'primary' : 'tertiary'}
            onClick={() => onPresetChange(item.key)}
          >
            {item.label}
          </Button>
        ))}
      </div>
      <div className='portal-range-bar__controls'>
        <DatePicker
          type='dateTimeRange'
          value={pickerValue}
          onChange={(value, valueString) =>
            onDateRangeChange(normalizeChangeResult(value, valueString))
          }
          density='default'
          insetLabel={t('时间范围')}
        />
        <Select
          className='portal-range-bar__granularity'
          value={defaultTime}
          optionList={timeOptions}
          onChange={onDefaultTimeChange}
          insetLabel={t('粒度')}
        />
        <Button
          icon={<IconRefresh />}
          loading={refreshing}
          onClick={onRefresh}
          type='primary'
        >
          {t('刷新数据')}
        </Button>
      </div>
    </div>
  );
};

export default PortalTimeRangeBar;
