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

import { Button, DatePicker, Select } from '@douyinfe/semi-ui';
import { IconRefresh } from '@douyinfe/semi-icons';

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
          value={dateRange}
          onChange={(value, valueString) =>
            onDateRangeChange(
              Array.isArray(valueString) && valueString.length === 2
                ? valueString
                : value,
            )
          }
          density='default'
          insetLabel='时间范围'
        />
        <Select
          className='portal-range-bar__granularity'
          value={defaultTime}
          optionList={timeOptions}
          onChange={onDefaultTimeChange}
          insetLabel='粒度'
        />
        <Button
          icon={<IconRefresh />}
          loading={refreshing}
          onClick={onRefresh}
          type='primary'
        >
          刷新数据
        </Button>
      </div>
    </div>
  );
};

export default PortalTimeRangeBar;
