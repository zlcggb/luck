import * as XLSX from 'xlsx';
import { Participant, DrawRecord } from '../types';

// 解析 Excel 文件用于预览
export const parseExcelFile = (file: File): Promise<{ headers: string[], data: any[] }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // 获取表头
        const headers = XLSX.utils.sheet_to_json(worksheet, { header: 1 })[0] as string[];
        // 获取数据
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        
        resolve({ headers, data: jsonData });
      } catch (error) {
        reject(new Error('解析 Excel 失败'));
      }
    };
    reader.onerror = () => reject(new Error('读取文件失败'));
    reader.readAsBinaryString(file);
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

// 导出中奖记录到 Excel
export const exportWinnersToExcel = (records: DrawRecord[], filename = '年会中奖名单') => {
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
    alert('暂无中奖记录可导出');
    return;
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
