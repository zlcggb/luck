/**
 * 抽奖布局算法
 * 统一管理抽奖前和抽奖后的布局计算逻辑
 * 
 * 核心设计原则：
 * 1. 所有人在一屏内完整显示（不需要滚动）
 * 2. 卡片居中对齐，布局美观
 * 3. 通过算法自动计算，不硬编码
 */

export interface CardStyle {
  avatar: string;
  name: string;
  dept: string;
  id?: string;
  layout?: string;
  iconSize?: string;
  padding?: string;
  container?: string;
}

export interface LayoutConfig {
  // 行配置：每个元素表示该行的列数
  rows: number[];
  // 卡片样式
  style: CardStyle;
  // 是否使用 flex 布局（用于非规则网格）
  useFlex: boolean;
  // grid 类名（仅当 useFlex=false 时使用）
  gridClass?: string;
}

/**
 * 计算最优的行列布局
 * 
 * 策略：
 * 1. 尽量让最后一行的空缺最少
 * 2. 行数不超过4行（确保一屏显示）
 * 3. 每行居中显示
 * 
 * @param count 总人数
 * @returns 每行的人数配置，如 [3, 2] 表示第一行3人，第二行2人
 */
export const calculateOptimalRows = (count: number): number[] => {
  if (count <= 0) return [];
  if (count === 1) return [1];
  if (count === 2) return [2];
  if (count === 3) return [3];
  if (count === 4) return [4]; // 1行4个，或者可以改为 [2, 2]
  if (count === 5) return [3, 2]; // 3+2 布局
  if (count === 6) return [3, 3]; // 3+3 布局
  if (count === 7) return [4, 3]; // 4+3 布局
  if (count === 8) return [4, 4]; // 4+4 布局
  if (count === 9) return [3, 3, 3]; // 3x3 布局
  if (count === 10) return [5, 5]; // 5+5 布局
  if (count === 11) return [4, 4, 3]; // 4+4+3
  if (count === 12) return [4, 4, 4]; // 4+4+4
  if (count === 13) return [5, 4, 4]; // 5+4+4
  if (count === 14) return [5, 5, 4]; // 5+5+4
  if (count === 15) return [5, 5, 5]; // 5+5+5
  if (count === 16) return [4, 4, 4, 4]; // 4x4
  if (count === 17) return [5, 4, 4, 4]; // 5+4+4+4
  if (count === 18) return [6, 6, 6]; // 6+6+6
  if (count === 19) return [5, 5, 5, 4]; // 5+5+5+4
  if (count === 20) return [5, 5, 5, 5]; // 5+5+5+5
  
  // 超过20人，用通用算法
  // 目标：最多4行，每行最多8人
  const maxCols = 8;
  const maxRows = 4;
  
  // 计算每行需要多少人
  const basePerRow = Math.ceil(count / maxRows);
  const cols = Math.min(basePerRow, maxCols);
  const rowCount = Math.ceil(count / cols);
  
  const rows: number[] = [];
  let remaining = count;
  
  for (let i = 0; i < rowCount; i++) {
    const rowSize = Math.min(remaining, cols);
    rows.push(rowSize);
    remaining -= rowSize;
  }
  
  return rows;
};

/**
 * 根据行数和每行最大列数计算卡片样式
 * 
 * @param rowCount 总行数
 * @param maxColsPerRow 每行最大列数
 * @returns 卡片样式配置
 */
export const calculateCardStyle = (rowCount: number, maxColsPerRow: number): CardStyle => {
  // 基于行数和列数计算卡片大小
  // 行数越多、列数越多 -> 卡片越小
  
  if (rowCount === 1) {
    // 单行布局
    if (maxColsPerRow === 1) {
      return {
        avatar: 'w-32 h-32 md:w-40 md:h-40 lg:w-48 lg:h-48 border-4',
        name: 'text-3xl md:text-5xl lg:text-6xl',
        dept: 'text-base md:text-xl lg:text-2xl',
        id: 'text-sm md:text-base',
        padding: 'p-6 md:p-8',
        layout: 'flex-col gap-4',
        container: 'w-full max-w-[320px] md:max-w-[400px] aspect-[4/5] md:aspect-square mx-auto shadow-2xl'
      };
    }
    if (maxColsPerRow <= 2) {
      return {
        avatar: 'w-24 h-24 md:w-32 md:h-32 lg:w-36 lg:h-36 border-3',
        name: 'text-2xl md:text-3xl lg:text-4xl',
        dept: 'text-sm md:text-base lg:text-lg',
        id: 'text-xs md:text-sm',
        padding: 'p-4 md:p-6',
        layout: 'flex-col gap-3',
        container: 'flex-1 max-w-[280px] aspect-[4/5] md:aspect-square'
      };
    }
    if (maxColsPerRow <= 4) {
      return {
        avatar: 'w-16 h-16 md:w-20 md:h-20 lg:w-24 lg:h-24 border-2',
        name: 'text-lg md:text-xl lg:text-2xl',
        dept: 'text-xs md:text-sm',
        id: 'text-[10px] md:text-xs',
        padding: 'p-3 md:p-4',
        layout: 'flex-col gap-2',
        container: 'flex-1 max-w-[220px] md:max-w-[240px]'
      };
    }
    return {
      avatar: 'w-12 h-12 md:w-14 md:h-14 lg:w-16 lg:h-16 border-2',
      name: 'text-sm md:text-base lg:text-lg',
      dept: 'text-[10px] md:text-xs',
      id: 'text-[9px] md:text-[10px]',
      padding: 'p-2 md:p-3',
      layout: 'flex-col gap-1.5',
      container: 'flex-1 max-w-[180px] md:max-w-[200px]'
    };
  }
  
  if (rowCount === 2) {
    // 2行布局
    if (maxColsPerRow <= 3) {
      return {
        avatar: 'w-16 h-16 md:w-20 md:h-20 lg:w-24 lg:h-24 border-2',
        name: 'text-lg md:text-xl lg:text-2xl',
        dept: 'text-xs md:text-sm',
        id: 'text-[10px] md:text-xs',
        padding: 'p-3 md:p-4',
        layout: 'flex-col gap-2',
        container: 'flex-1 max-w-[200px] md:max-w-[220px]'
      };
    }
    if (maxColsPerRow <= 5) {
      return {
        avatar: 'w-12 h-12 md:w-16 md:h-16 lg:w-20 lg:h-20 border-2',
        name: 'text-base md:text-lg lg:text-xl',
        dept: 'text-[10px] md:text-xs lg:text-sm',
        id: 'text-[9px] md:text-[10px]',
        padding: 'p-2 md:p-3',
        layout: 'flex-col gap-1.5',
        container: 'flex-1 max-w-[160px] md:max-w-[180px]'
      };
    }
    return {
      avatar: 'w-10 h-10 md:w-12 md:h-12 lg:w-14 lg:h-14 border-2',
      name: 'text-sm md:text-base lg:text-lg',
      dept: 'text-[9px] md:text-[10px]',
      id: 'text-[8px] md:text-[9px]',
      padding: 'p-2 md:p-2.5',
      layout: 'flex-col gap-1',
      container: 'flex-1 max-w-[140px] md:max-w-[160px]'
    };
  }
  
  if (rowCount === 3) {
    // 3行布局
    if (maxColsPerRow <= 4) {
      return {
        avatar: 'w-12 h-12 md:w-14 md:h-14 lg:w-16 lg:h-16 border-2',
        name: 'text-sm md:text-base lg:text-lg',
        dept: 'text-[10px] md:text-xs',
        id: 'text-[9px] md:text-[10px]',
        padding: 'p-2 md:p-3',
        layout: 'flex-col gap-1.5',
        container: 'flex-1 max-w-[160px] md:max-w-[180px]'
      };
    }
    return {
      avatar: 'w-10 h-10 md:w-12 md:h-12 lg:w-14 lg:h-14 border-2',
      name: 'text-xs md:text-sm lg:text-base',
      dept: 'text-[9px] md:text-[10px]',
      id: 'text-[8px] md:text-[9px]',
      padding: 'p-1.5 md:p-2',
      layout: 'flex-col gap-1',
      container: 'flex-1 max-w-[130px] md:max-w-[150px]'
    };
  }
  
  // 4行及以上
  if (maxColsPerRow <= 4) {
    return {
      avatar: 'w-10 h-10 md:w-12 md:h-12 lg:w-14 lg:h-14 border-2',
      name: 'text-xs md:text-sm lg:text-base',
      dept: 'text-[9px] md:text-[10px]',
      id: 'text-[8px] md:text-[9px]',
      padding: 'p-1.5 md:p-2',
      layout: 'flex-col gap-1',
      container: 'flex-1 max-w-[130px] md:max-w-[150px]'
    };
  }
  return {
    avatar: 'w-8 h-8 md:w-10 md:h-10 lg:w-12 lg:h-12 border',
    name: 'text-[10px] md:text-xs lg:text-sm',
    dept: 'text-[8px] md:text-[9px]',
    id: 'text-[7px] md:text-[8px]',
    padding: 'p-1 md:p-1.5',
    layout: 'flex-col gap-0.5',
    container: 'flex-1 max-w-[100px] md:max-w-[120px]'
  };
};

/**
 * 计算完整的布局配置
 * 
 * @param count 总人数
 * @returns 完整的布局配置
 */
export const calculateLayout = (count: number): LayoutConfig => {
  const rows = calculateOptimalRows(count);
  const rowCount = rows.length;
  const maxColsPerRow = Math.max(...rows, 1);
  const style = calculateCardStyle(rowCount, maxColsPerRow);
  
  // 判断是否所有行的列数相同
  const isRegularGrid = rows.every(r => r === rows[0]);
  
  return {
    rows,
    style,
    useFlex: !isRegularGrid, // 非规则布局使用 flex
    gridClass: isRegularGrid ? `grid-cols-${rows[0]}` : undefined
  };
};

/**
 * 判断是否需要特殊布局（非规则网格）
 */
export const needsSpecialLayout = (count: number): boolean => {
  const rows = calculateOptimalRows(count);
  // 如果各行列数不同，需要特殊布局
  return !rows.every(r => r === rows[0]);
};

/**
 * 获取特殊布局的行配置
 */
export const getSpecialLayoutRows = (count: number): number[][] => {
  const rows = calculateOptimalRows(count);
  return rows.map(r => [r]);
};

/**
 * 生成动态网格类名（用于规则网格）
 */
export const getGridClass = (count: number): string => {
  const rows = calculateOptimalRows(count);
  if (rows.length === 0) return "grid-cols-1";
  
  const cols = rows[0];
  const gridColsMap: { [key: number]: string } = {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
    5: 'grid-cols-5',
    6: 'grid-cols-6',
    7: 'grid-cols-7',
    8: 'grid-cols-8',
  };
  
  return gridColsMap[cols] || 'grid-cols-4';
};

/**
 * 根据人数获取卡片样式（抽奖时使用）
 * 直接调用通用算法
 */
export const getDrawingCardStyle = (batchSize: number): CardStyle => {
  const layout = calculateLayout(batchSize);
  return layout.style;
};

/**
 * 计算汇总页面的布局
 * 复用通用布局算法
 */
export const calculateSummaryLayout = (count: number): {
  cols: number;
  rows: number;
  style: CardStyle;
  gridClass: string;
  layoutConfig: LayoutConfig;
} => {
  const layoutConfig = calculateLayout(count);
  const maxCols = Math.max(...layoutConfig.rows, 1);
  const rowCount = layoutConfig.rows.length;
  
  // 生成响应式 grid 类
  const gridColsMap: { [key: number]: string } = {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
    5: 'grid-cols-5',
    6: 'grid-cols-6',
    7: 'grid-cols-7',
    8: 'grid-cols-8',
  };
  
  let gridClass = gridColsMap[maxCols] || 'grid-cols-4';
  
  // 响应式处理
  if (maxCols >= 6) {
    const smallCols = Math.max(3, Math.ceil(maxCols / 2));
    gridClass = `${gridColsMap[smallCols]} md:${gridColsMap[maxCols]}`;
  } else if (maxCols >= 4) {
    const smallCols = maxCols - 1;
    gridClass = `${gridColsMap[smallCols]} md:${gridColsMap[maxCols]}`;
  }
  
  return {
    cols: maxCols,
    rows: rowCount,
    style: layoutConfig.style,
    gridClass,
    layoutConfig
  };
};
