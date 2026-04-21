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

export const PORTAL_SKIN_STORAGE_KEY = 'portal_skin_preference';
export const PORTAL_SIDEBAR_COLLAPSED_KEY = 'portal_sidebar_collapsed';
export const DEFAULT_PORTAL_SKIN = 'summit-dark';

export const PORTAL_SKINS = [
  {
    key: 'pulse-light',
    family: 'pulse',
    mode: 'light',
    title: 'Pulse',
    summary: '时尚浅色',
    accent: '#ff4d8d',
    accentAlt: '#7c3aed',
    preview: ['#ff4d8d', '#ff8fb6', '#ffd9e8'],
  },
  {
    key: 'pulse-dark',
    family: 'pulse',
    mode: 'dark',
    title: 'Pulse Dark',
    summary: '时尚深色',
    accent: '#ff5c93',
    accentAlt: '#9f7aea',
    preview: ['#ff5c93', '#8b5cf6', '#16122a'],
  },
  {
    key: 'summit-light',
    family: 'summit',
    mode: 'light',
    title: 'Summit',
    summary: '大气浅色',
    accent: '#2563eb',
    accentAlt: '#0f766e',
    preview: ['#2563eb', '#38bdf8', '#dbeafe'],
  },
  {
    key: 'summit-dark',
    family: 'summit',
    mode: 'dark',
    title: 'Summit Dark',
    summary: '大气深色',
    accent: '#60a5fa',
    accentAlt: '#22d3ee',
    preview: ['#60a5fa', '#22d3ee', '#0b1220'],
  },
  {
    key: 'mist-light',
    family: 'mist',
    mode: 'light',
    title: 'Mist',
    summary: '护眼浅色',
    accent: '#2f855a',
    accentAlt: '#3b82f6',
    preview: ['#2f855a', '#93c5fd', '#eefbf4'],
  },
  {
    key: 'mist-dark',
    family: 'mist',
    mode: 'dark',
    title: 'Mist Dark',
    summary: '护眼深色',
    accent: '#4ade80',
    accentAlt: '#38bdf8',
    preview: ['#4ade80', '#38bdf8', '#091714'],
  },
];

export const PORTAL_SKIN_MAP = PORTAL_SKINS.reduce((acc, skin) => {
  acc[skin.key] = skin;
  return acc;
}, {});

export const getPortalSkin = (skinKey) =>
  PORTAL_SKIN_MAP[skinKey] || PORTAL_SKIN_MAP[DEFAULT_PORTAL_SKIN];

const buildPortalChartPalette = (skin) => {
  const darkPalette = {
    pulse: ['#ff5c93', '#9f7aea', '#38bdf8', '#f59e0b', '#34d399', '#f87171'],
    summit: ['#60a5fa', '#22d3ee', '#38bdf8', '#f59e0b', '#34d399', '#a78bfa'],
    mist: ['#4ade80', '#38bdf8', '#2dd4bf', '#fbbf24', '#60a5fa', '#fb7185'],
  };
  const lightPalette = {
    pulse: ['#ff4d8d', '#7c3aed', '#2563eb', '#f97316', '#16a34a', '#e11d48'],
    summit: ['#2563eb', '#0f766e', '#0284c7', '#d97706', '#16a34a', '#7c3aed'],
    mist: ['#2f855a', '#3b82f6', '#0f766e', '#d97706', '#2563eb', '#db2777'],
  };

  const paletteGroup = skin.mode === 'dark' ? darkPalette : lightPalette;
  return paletteGroup[skin.family] || paletteGroup.summit;
};

export const getPortalChartTheme = (skinKey) => {
  const skin = getPortalSkin(skinKey);
  const isDark = skin.mode === 'dark';

  return {
    skinKey: skin.key,
    palette: buildPortalChartPalette(skin),
    titleColor: isDark ? '#f4f8ff' : '#0f172a',
    subtextColor: isDark ? '#c6d4e5' : '#334155',
    axisTextColor: isDark ? '#d5e2f0' : '#475569',
    legendTextColor: isDark ? '#eff5ff' : '#0f172a',
    labelColor: isDark ? '#f4f8ff' : '#0f172a',
    gridColor: isDark
      ? 'rgba(148, 163, 184, 0.16)'
      : 'rgba(100, 116, 139, 0.12)',
    axisLineColor: isDark
      ? 'rgba(148, 163, 184, 0.2)'
      : 'rgba(100, 116, 139, 0.16)',
    tooltipBackground: isDark
      ? 'rgba(9, 18, 32, 0.94)'
      : 'rgba(255, 255, 255, 0.96)',
    tooltipBorderColor: isDark
      ? 'rgba(148, 163, 184, 0.22)'
      : 'rgba(37, 99, 235, 0.1)',
    tooltipTextColor: isDark ? '#f8fbff' : '#0f172a',
    hoverStroke: isDark ? 'rgba(255, 255, 255, 0.42)' : 'rgba(15, 23, 42, 0.14)',
    areaOpacity: isDark ? 0.22 : 0.18,
  };
};

const buildPortalChartAxes = (spec, variant) => {
  if (Array.isArray(spec?.axes) && spec.axes.length > 0) {
    return spec.axes;
  }

  if (variant === 'pie') {
    return spec?.axes;
  }

  return [
    {
      orient: 'bottom',
      type: 'band',
      tick: { visible: false },
      label: { visible: true },
      grid: { visible: false },
      domainLine: { visible: false },
    },
    {
      orient: 'left',
      type: 'linear',
      tick: { visible: false },
      label: { visible: true },
      grid: { visible: true },
      domainLine: { visible: false },
    },
  ];
};

export const getPortalChartDisplaySpec = (
  spec,
  { variant = 'bar', hideLegend = false } = {},
) => {
  if (!spec) {
    return spec;
  }

  const nextSpec = {
    ...spec,
    animation: false,
    title: spec.title
      ? {
          ...spec.title,
          visible: false,
        }
      : spec.title,
    padding:
      variant === 'pie'
        ? { top: 8, right: 6, bottom: 4, left: 6 }
        : { top: 12, right: 4, bottom: 6, left: 0 },
    legends: hideLegend
      ? {
          ...(spec.legends || {}),
          visible: false,
        }
      : {
          ...(spec.legends || {}),
          visible: spec.legends?.visible ?? true,
          orient: variant === 'pie' ? 'bottom' : 'top',
        },
    axes: buildPortalChartAxes(spec, variant),
  };

  if (variant === 'bar' && spec.bar) {
    nextSpec.bar = {
      ...spec.bar,
      style: {
        ...(spec.bar?.style || {}),
        cornerRadius: 10,
        fillOpacity: 0.94,
      },
    };
  }

  if (variant === 'line') {
    nextSpec.line = {
      ...(spec.line || {}),
      style: {
        ...(spec.line?.style || {}),
        lineWidth: 3,
      },
    };
    nextSpec.point = {
      ...(spec.point || {}),
      visible: true,
      style: {
        ...(spec.point?.style || {}),
        size: 7,
        lineWidth: 2,
      },
    };
  }

  if (variant === 'pie' && spec.pie) {
    nextSpec.pie = {
      ...spec.pie,
      style: {
        ...(spec.pie?.style || {}),
        cornerRadius: 8,
      },
    };
    nextSpec.label = {
      ...(spec.label || {}),
      visible: false,
    };
  }

  return nextSpec;
};
