import * as XLSX from 'xlsx';
import { Participant, DrawRecord } from '../types';

// 解析 Excel 文件用于预览
export const parseExcelFile = (file: File): Promise<{ headers: string[], data: any[] }> => {
  return new Promise((resolve, reject) => {
    // 验证文件类型
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'application/x-excel',
      'application/x-msexcel',
    ];
    const validExtensions = ['.xlsx', '.xls'];
    const fileName = file.name.toLowerCase();
    const hasValidExtension = validExtensions.some(ext => fileName.endsWith(ext));
    
    console.log('[Excel Import] 文件名:', file.name);
    console.log('[Excel Import] 文件类型:', file.type);
    console.log('[Excel Import] 文件大小:', file.size, 'bytes');
    
    // 放宽验证，只检查扩展名（因为 MIME 类型在某些浏览器/系统可能不正确）
    if (!hasValidExtension && !validTypes.includes(file.type)) {
      console.error('[Excel Import] 不支持的文件格式');
      reject(new Error(`不支持的文件格式: ${file.type || '未知'}。请使用 .xlsx 或 .xls 格式的 Excel 文件。`));
      return;
    }

    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const arrayBuffer = e.target?.result;
        if (!arrayBuffer) {
          throw new Error('文件内容为空');
        }
        
        console.log('[Excel Import] 开始解析 Excel 文件...');
        
        // 使用 ArrayBuffer 类型读取（比 binary 更可靠）
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        
        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          throw new Error('Excel 文件中没有工作表');
        }
        
        const sheetName = workbook.SheetNames[0];
        console.log('[Excel Import] 读取工作表:', sheetName);
        
        const worksheet = workbook.Sheets[sheetName];
        
        if (!worksheet) {
          throw new Error('无法读取工作表内容');
        }
        
        // 获取表头
        const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        
        if (!rawData || rawData.length === 0) {
          throw new Error('Excel 文件内容为空');
        }
        
        const headers = (rawData[0] || []).map((h: any) => String(h || '').trim()).filter(Boolean);
        
        if (headers.length === 0) {
          throw new Error('无法识别表头，请确保第一行包含列标题');
        }
        
        // 获取数据
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        
        console.log('[Excel Import] 解析成功! 表头:', headers);
        console.log('[Excel Import] 数据行数:', jsonData.length);
        
        resolve({ headers, data: jsonData });
      } catch (error) {
        console.error('[Excel Import] 解析失败:', error);
        const errorMessage = error instanceof Error ? error.message : '未知错误';
        reject(new Error(`解析 Excel 失败: ${errorMessage}`));
      }
    };
    
    reader.onerror = (e) => {
      console.error('[Excel Import] 读取文件失败:', e);
      reject(new Error('读取文件失败，请检查文件是否损坏'));
    };
    
    // 使用 ArrayBuffer 方式读取（更可靠，兼容性更好）
    reader.readAsArrayBuffer(file);
  });
};

// 根据映射导入数据
export const processImportData = (data: any[], mapping: { id: string, name: string, dept: string }): Participant[] => {
  return data.map((row, index) => {
    const id = row[mapping.id] || String(index + 1);
    const name = row[mapping.name] || '未知';
    const dept = row[mapping.dept] || '';
    
    return {
      id: String(id).trim(),
      name: String(name).trim(),
      dept: String(dept).trim(),
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(id)}`,
    };
  }).filter(p => p.id && p.name && p.name !== '未知');
};

// 保持向后兼容的简易导入（自动猜测）
export const importParticipantsFromExcel = async (file: File): Promise<Participant[]> => {
  const { headers, data } = await parseExcelFile(file);
  
  // 简单的自动匹配逻辑
  const mapping = {
    id: headers.find(h => ['工号', 'ID', 'id', 'EmployeeID'].includes(h)) || '',
    name: headers.find(h => ['姓名', 'Name', 'name'].includes(h)) || '',
    dept: headers.find(h => ['部门', '组织', 'Dept', 'Department'].includes(h)) || '',
  };
  
  if (!mapping.name) {
    throw new Error('无法自动识别"姓名"列，请尝试使用手动映射模式');
  }

  return processImportData(data, mapping);
};

// 导出中奖记录到 Excel，返回是否成功
export const exportWinnersToExcel = (records: DrawRecord[], filename = '年会中奖名单'): boolean => {
  const rows: Record<string, string>[] = [];
  
  records.forEach((record) => {
    record.winners.forEach((winner) => {
      rows.push({
        '奖项': record.prizeName,
        '抽奖时间': new Date(record.timestamp).toLocaleString('zh-CN'),
        '工号': winner.id,
        '姓名': winner.name,
        '部门': winner.dept,
      });
    });
  });
  
  if (rows.length === 0) {
    return false; // 让调用方决定如何提示
  }
  
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '中奖名单');
  
  // 设置列宽
  worksheet['!cols'] = [
    { wch: 15 }, // 奖项
    { wch: 22 }, // 时间
    { wch: 15 }, // ID
    { wch: 12 }, // 姓名
    { wch: 20 }, // 部门
  ];
  
  // 生成二进制流下载，解决兼容性问题
  const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  // 使用正确的 MIME type 用于 .xlsx
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  
  const timestamp = new Date().toLocaleDateString('zh-CN').replace(/\//g, '-');
  const finalName = `${filename}_${timestamp}.xlsx`;
  
  // 手动创建下载链接
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = finalName; // Explicitly set download attribute
  a.style.display = 'none'; // Safer
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return true;
};

// 生成导入模板
export const downloadTemplate = () => {
  const templateData = [
    { '工号': 'EMP001', '姓名': '张三', '部门': '技术部 (示例)' },
    { '工号': 'EMP002', '姓名': 'Lisa', '部门': '市场部 (示例)' },
  ];
  
  const worksheet = XLSX.utils.json_to_sheet(templateData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '名单模板');
  
  const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = '抽奖名单导入模板.xlsx';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
