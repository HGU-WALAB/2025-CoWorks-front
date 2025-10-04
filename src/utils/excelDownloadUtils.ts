import * as XLSX from 'xlsx';

// 엑셀 파일 다운로드 유틸리티
export const downloadExcelTemplate = () => {
  // 엑셀 파일의 헤더 정의
  const headers = [
    'id', // 학번(22100XXX)
    'name', // 이름
    'email', // 이메일
    'course' // 교과목 이름
  ];

  // 샘플 데이터 (사용자가 참고할 수 있도록)
  const sampleData = [
    ['학번(22100XXX)', '이름', '이메일', '교과목 이름']
  ];

  // 워크시트 데이터 생성
  const worksheetData = [headers, ...sampleData];

  // 워크북 생성
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

  // 컬럼 너비 설정
  const columnWidths = [
    { wch: 15 }, // 학번
    { wch: 10 }, // 이름
    { wch: 35 }, // 이메일
    { wch: 25 }, // 교과목 이름
  ];
  worksheet['!cols'] = columnWidths;

  // 워크시트를 워크북에 추가
  XLSX.utils.book_append_sheet(workbook, worksheet, 'TA_리스트');

  // 파일명 생성 (현재 날짜 포함)
  const now = new Date();
  const dateString = now.toISOString().split('T')[0];
  const fileName = `TA_리스트_${dateString}.xlsx`;

  // 엑셀 파일 다운로드
  XLSX.writeFile(workbook, fileName);
};


// 사용자 데이터를 엑셀 파일로 다운로드하는 함수
export const downloadUsersExcel = (users: Array<{
  id?: string;
  name?: string;
  email?: string;
  course?: string;
}>, fileName?: string) => {
  if (!users || users.length === 0) {
    alert('다운로드할 사용자 데이터가 없습니다.');
    return;
  }

  // 워크시트 데이터 생성
  const worksheetData = users.map(user => [
    user.id || '',
    user.name || '',
    user.email || '',
    user.course || ''
  ]);

  // 헤더 추가
  const headers = ['id', 'name', 'email', 'course'];
  worksheetData.unshift(headers);

  // 워크북 생성
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

  // 컬럼 너비 설정
  const columnWidths = [
    { wch: 15 }, // 학번
    { wch: 10 }, // 이름
    { wch: 35 }, // 이메일
    { wch: 25 }, // 교과목 이름
  ];
  worksheet['!cols'] = columnWidths;

  // 워크시트를 워크북에 추가
  XLSX.utils.book_append_sheet(workbook, worksheet, 'TA_리스트');

  // 파일명 설정
  const defaultFileName = fileName || `TA_리스트_${new Date().toISOString().split('T')[0]}.xlsx`;

  // 엑셀 파일 다운로드
  XLSX.writeFile(workbook, defaultFileName);
};
