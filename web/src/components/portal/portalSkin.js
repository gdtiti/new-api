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
