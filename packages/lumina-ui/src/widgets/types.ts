import type { Component } from "vue";

export interface WidgetDefinition<Config = Record<string, unknown>> {
  /** 唯一类型标识 */
  type: string;
  /** 显示名称 */
  name: string;
  /** 描述 */
  description?: string;
  /** 组件 */
  component: Component;
  /** 默认宽高（grid 单位） */
  defaultSize?: { w: number; h: number };
  /** 最小宽高 */
  minSize?: { w: number; h: number };
  /** 默认配置 */
  defaultConfig?: Config;
}

export interface LayoutItem<Config = Record<string, unknown>> {
  /** 布局中唯一 id */
  id: string;
  /** Widget 类型 */
  type: string;
  /** 列起始位置，0-based */
  x: number;
  /** 行起始位置，0-based */
  y: number;
  /** 占几列 */
  w: number;
  /** 占几行 */
  h: number;
  /** Widget 私有配置 */
  config?: Config;
}

export interface DashboardLayout<Config = Record<string, unknown>> {
  /** 列数，默认 12 */
  columns?: number;
  /** 每行高度 px，默认 80 */
  rowHeight?: number;
  /** 间距 px，默认 16 */
  gap?: number;
  /** Widget 布局 */
  widgets: LayoutItem<Config>[];
}
