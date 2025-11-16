import React from 'react';

interface PolicySectionProps {
  title: string;
  children: React.ReactNode;
}

const PolicySection: React.FC<PolicySectionProps> = ({ title, children }) => (
  <div className="my-8">
    <h2 className="text-xl font-semibold text-gray-900 mb-4">{title}</h2>
    <div className="text-gray-700">{children}</div>
    <div className="border-t border-gray-200 mt-4"></div>
  </div>
);

const PrivacyPolicy: React.FC = () => {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">개인정보처리방침</h1>
        <div className="bg-white rounded-lg shadow-sm p-6">
          <p className="text-gray-700 mb-4">
            CoWorks(이하 &quot;서비스&quot;)는 이용자의 개인정보 보호를 매우 중요하게 생각하며,
            「개인정보 보호법」 등 관련 법령을 준수합니다. 본 개인정보처리방침은 서비스를 이용하는
            이용자(이하 &quot;이용자&quot;)의 개인정보가 어떻게 수집·이용·보관·파기되는지를 설명합니다.
          </p>
          <p className="text-gray-700 mb-6">본 방침은 2025년 11월 1일부터 적용됩니다.</p>

          <PolicySection title="1. 개인정보의 수집 항목 및 이용 목적">
            <div className="mb-4">
              <h3 className="text-lg font-medium text-gray-900 mb-2">1) 수집 항목</h3>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>
                  필수 정보: 이름, 학번 또는 사번, 이메일 주소(학교 계정), 소속(학부/부서), 사용자
                  구분(학생/교직원/교수)
                </li>
                <li>
                  자동 수집 정보: 로그인 시간, 접속 로그, IP 주소, 브라우저 정보, 기기 정보
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">2) 이용 목적</h3>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>이용자 식별 및 학교 구성원 인증</li>
                <li>템플릿, 문서 등록 및 편집 기능 제공</li>
                <li>서비스 개선을 위한 통계 분석 및 사용자 피드백 반영</li>
                <li>메일 발송 및 사용자 맞춤형 기능 제공</li>
              </ul>
            </div>
          </PolicySection>

          <PolicySection title="2. 개인정보의 보유 및 이용 기간">
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>
                서비스는 원칙적으로 개인정보 수집 및 이용 목적이 달성된 후에는 해당 정보를 지체
                없이 파기합니다.
              </li>
              <li>사용자 탈퇴 요청 시: 즉시 파기</li>
              <li>불량 이용자 기록 및 악성 사용 탐지를 위한 기록: 최대 6개월</li>
              <li>
                법령에 따라 보존할 필요가 있는 경우: 해당 법령이 정한 기간 동안 보관
              </li>
            </ul>
          </PolicySection>

          <PolicySection title="3. 개인정보의 제3자 제공">
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>
                서비스는 이용자의 개인정보를 원칙적으로 외부에 제공하지 않습니다.
              </li>
              <li>이용자가 사전에 동의한 경우</li>
              <li>법령에 의해 제공이 요구되는 경우</li>
              <li>범죄 수사, 소송 진행 등 공공기관의 요청이 있는 경우</li>
            </ul>
          </PolicySection>

          <PolicySection title="4. 개인정보의 처리 위탁">
            <p>
              현재 서비스는 개인정보 처리를 외부에 위탁하지 않으며, 향후 위탁이 발생하는 경우
              사전에 고지하고 동의를 받습니다.
            </p>
          </PolicySection>

          <PolicySection title="5. 이용자의 권리와 그 행사 방법">
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>
                이용자는 언제든지 자신의 개인정보를 조회하거나 수정할 수 있으며, 서비스 탈퇴를
                요청할 수 있습니다.
              </li>
              <li>
                개인정보 열람, 정정, 삭제 요청은 이메일 또는 문의 기능을 통해 접수 가능
              </li>
            </ul>
          </PolicySection>

          <PolicySection title="6. 개인정보의 파기 절차 및 방법">
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>
                파기 절차: 보유 목적이 달성된 후 내부 방침에 따라 일정 기간 저장된 후 즉시 파기
              </li>
              <li>
                파기 방법: 전자적 파일은 복구 불가능한 기술적 방법으로 삭제, 출력물은 분쇄 또는
                소각
              </li>
            </ul>
          </PolicySection>

          <PolicySection title="7. 개인정보 보호를 위한 기술적·관리적 대책">
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>사용자 인증은 Hisnet 인증 시스템을 통해 안전하게 처리</li>
              <li>
                모든 개인정보는 암호화된 형태로 저장되며, 불법 접근 방지를 위한 방화벽 및 접근
                제어 시스템 운영
              </li>
              <li>
                개인정보 접근 권한은 최소한의 인원에게만 부여되며, 주기적인 보안 점검 및 교육 실시
              </li>
            </ul>
          </PolicySection>

          <PolicySection title="8. 변경사항 고지">
            <p className="mb-2">
              개인정보처리방침이 변경되는 경우 변경 사항은 최소 7일 전부터 서비스 내 공지를 통해
              알립니다.
            </p>
            <p className="text-gray-600">시행일자: 2025년 11월 1일</p>
          </PolicySection>
        </div>
      </div>
  );
};

export default PrivacyPolicy;
