// 개인정보 처리방침 페이지
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '개인정보 처리방침 - 릴스탬프',
  description: '릴스탬프 개인정보 처리방침',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-8">릴스탬프 개인정보처리방침</h1>
        
        <div className="prose prose-lg max-w-none">
          <section className="mb-8">
            <p className="text-gray-700 leading-relaxed mb-4">
              릴스탬프(이하 &quot;릴스탬프&quot;)는 개인정보의 수집·이용 및 제공 등에 관하여 대한민국 관계 법령을 준수하며, 이용자의 개인정보에 관한 권리를 보장합니다. 본 개인정보처리방침은 오늘의 릴스 트렌드, 템플릿 탐색 및 가이드, 갤러리 영상 불러오기, 컷별 영상·텍스트 편집과 결과물 내보내기를 제공하는 마케팅 릴스 템플릿 편집기 서비스(이하 &quot;서비스&quot;)에 적용됩니다.
            </p>
            <p className="text-gray-700 leading-relaxed">
              릴스탬프는 로그인 화면에서 서비스 이용약관과 본 개인정보처리방침을 확인할 수 있도록 안내합니다. 서비스 이용약관에 대한 동의와 개인정보 처리에 대한 동의는 구분됩니다. 계정 생성·관리 및 서비스 제공을 위한 계약의 체결·이행에 필요한 개인정보는 「개인정보 보호법」 제15조 제1항 제4호에 따라 필요한 범위에서 처리합니다. 별도의 동의가 필요한 개인정보 처리에 대해서는 수집·이용 목적, 항목, 보유·이용기간 및 동의 거부에 관한 사항 등을 안내하고 해당 동의를 받습니다.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">제1조 (수집하는 개인정보)</h2>
            <ol className="list-decimal list-inside space-y-4 text-gray-700">
              <li>수집 목적
                <p className="ml-6 mt-2">
                  릴스탬프는 서비스 이용을 위하여 필요한 이용자의 최소한의 개인정보를 수집하며, 이용자의 선택에 따라 마케팅 정보 제공을 위하여 이용자의 개인정보를 수집할 수 있습니다. 그 밖에 다른 목적으로 위 개인정보를 수집할 경우 이용자로부터 별도의 동의를 받습니다.
                </p>
              </li>
              <li>수집하는 개인정보의 항목
                <p className="font-semibold mt-2 mb-2">
                  이용자의 간편 로그인(소셜 로그인)을 통한 회원가입 시 수집되는 정보
                </p>
                <p className="font-semibold mb-2">
                  필수 수집하는 개인정보
                </p>
                <ul className="list-disc list-inside ml-6 space-y-1 mb-4">
                  <li>수집항목 : 이름, 이메일 주소</li>
                  <li>수집목적 : 릴스탬프의 계정 생성 및 관리, 서비스 제공, 이용자와의 의사소통 및 지원<br />처리의 법적 근거 : 「개인정보 보호법」 제15조 제1항 제4호(계약의 체결·이행에 필요한 처리). 위 항목은 해당 목적에 필요한 범위에서 동의 없이 처리합니다.</li>
                </ul>
                <p className="mb-2">
                  계정 생성 및 서비스 제공에 필요한 필수 정보를 제공하지 않는 경우에는 계정 생성 또는 해당 서비스 이용이 제한될 수 있습니다.
                </p>
                <p className="font-semibold mt-4 mb-2">
                  선택 수집하는 개인정보
                </p>
                <ul className="list-disc list-inside ml-6 space-y-1 mb-4">
                  <li>수집항목 : 휴대전화번호</li>
                  <li>수집목적 : 이용자가 요청한 상담 및 연락. 홍보·마케팅 정보 발송은 별도로 동의한 이용자에 한하여 해당 동의 범위에서 처리합니다.</li>
                </ul>
                <p className="mb-2">
                  선택 개인정보의 수집·이용에 동의하지 않더라도 기본 서비스는 이용할 수 있습니다. 다만, 해당 정보를 필요로 하는 선택 기능의 이용은 제한될 수 있습니다.
                </p>
                <p className="font-semibold mt-4 mb-2">
                  서비스 이용 과정에서 수집되는 정보
                </p>
                <p className="font-semibold mb-2">
                  필수 수집하는 개인정보
                </p>
                <ul className="list-disc list-inside ml-6 space-y-1 mb-4">
                  <li>수집항목 : 이용자 정보(ID, 닉네임), 기기 및 브라우저 정보, IP주소, 접속일시, 접속통계, 템플릿 선택·편집·내보내기 등 서비스 이용기록</li>
                  <li>수집목적 : 서비스 제공 및 이용 분석, 오류 확인, 서비스 개선 및 부정사용 모니터링</li>
                </ul>
                <p className="mb-2">
                  위 정보가 이용자를 식별할 수 있거나 다른 정보와 결합하여 이용자를 알아볼 수 있는 경우 개인정보로 처리합니다.
                </p>
                <p className="font-semibold mt-4 mb-2">
                  영상 편집 기능 이용 시 처리되는 정보
                </p>
                <ul className="list-disc list-inside ml-6 space-y-1 mb-4">
                  <li>처리항목 : 이용자가 갤러리에서 선택하여 불러온 영상(포함된 얼굴·음성 등 개인정보), 입력한 텍스트, 컷별 길이·구간·화면 설정 등 편집정보 및 편집 결과물</li>
                  <li>처리목적 : 선택한 영상의 템플릿 적용, 컷별 영상·텍스트 편집, 미리보기 및 결과물 내보내기</li>
                  <li>기기 접근 : 서비스 내 직접 촬영 기능은 제공하지 않으며, 갤러리 영상 선택에 필요한 범위에서 기기의 접근 권한을 요청합니다. 권한을 허용하지 않으면 영상 불러오기 기능이 제한될 수 있습니다.</li>
                  <li>처리범위 : 이용자가 영상 편집을 위하여 선택한 파일과 입력한 정보 중 서비스 제공에 필요한 범위로 한정합니다.</li>
                </ul>
              </li>
            </ol>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">제2조 (웹 기반 서비스 제공을 위한 쿠키의 설치 및 운영)</h2>
            <ol className="list-decimal list-inside space-y-4 text-gray-700">
              <li>쿠키란?
                <p className="ml-6 mt-2">
                  이용자가 웹사이트를 접속할 때 해당 웹사이트에서 이용자의 브라우저에 보내는 아주 작은 텍스트 파일로 이용자 PC에 저장됩니다.
                </p>
              </li>
              <li>사용목적
                <p className="ml-6 mt-2">
                  로그인 상태 및 이용자의 환경설정을 유지하고, 서비스 이용 현황을 분석하여 사용성과 안정성을 개선하기 위하여 쿠키를 사용할 수 있습니다.
                </p>
              </li>
              <li>쿠키 수집 거부
                <p className="ml-6 mt-2">
                  이용자는 사용하는 웹 브라우저의 개인정보 보호 또는 쿠키 설정에서 쿠키의 허용·차단·삭제를 선택할 수 있습니다. 설정 경로는 브라우저에 따라 다를 수 있습니다. 쿠키를 차단하면 로그인이 필요한 일부 기능의 이용이 제한될 수 있습니다.
                </p>
              </li>
              <li>수집방법
                <ul className="list-disc list-inside ml-6 space-y-1">
                  <li>회원가입, 상담 및 서비스 이용 과정에서 이용자가 직접 입력하거나 선택하여 불러온 정보를 처리하는 방법</li>
                  <li>서비스 이용 과정에서 접속정보 및 이용기록을 자동으로 수집하는 방법</li>
                  <li>간편 로그인 등 이용자가 선택한 외부 서비스를 통하여 적법하게 정보를 제공받는 방법</li>
                </ul>
                <p className="ml-6 mt-2">
                  제3자로부터 제공받은 개인정보를 릴스탬프가 처리하는 경우에도 본 개인정보처리방침이 적용됩니다.
                </p>
              </li>
            </ol>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">제3조 (수집한 개인정보의 이용)</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              릴스탬프는 계정 관리, 템플릿 기반 영상 편집 및 결과물 제공, 이용 분석, 고객 지원을 위하여 필요한 범위에서 개인정보를 처리합니다. 홍보·마케팅 정보 발송은 별도로 동의한 이용자에 한하여 처리합니다.
            </p>
            <ol className="list-decimal list-inside space-y-4 text-gray-700">
              <li>이용방법
                <ul className="list-disc list-inside ml-6 space-y-1">
                  <li>이용하는 개인정보 : 계정 및 연락처 정보, 이용자가 선택하여 불러온 영상과 그에 포함된 개인정보, 입력한 텍스트, 편집 설정 및 결과물, 서비스 이용기록</li>
                  <li>이용하는 목적 : 회원 인증, 템플릿 및 가이드 제공, 영상 불러오기, 컷별 길이·구간·화면 조정, 텍스트 편집, 미리보기 및 결과물 내보내기, 고지사항 전달, 문의·불만 처리, 서비스 오류 확인 및 이용 분석. 서비스 제공 범위를 넘어 이용자의 원본 영상이나 결과물을 홍보·레퍼런스 등 다른 목적으로 이용하려는 경우에는 별도의 적법한 근거를 마련합니다.</li>
                </ul>
              </li>
              <li>이용기간
                <p className="ml-6 mt-2">
                  회원정보는 원칙적으로 회원 탈퇴 시까지 보유하며, 영상·편집정보·결과물의 처리 및 보유기간은 제5조에 따릅니다. 별도 동의에 따라 처리하는 정보는 안내한 목적과 보유기간 내에서 처리합니다.
                </p>
                <p className="ml-6 mt-2">
                  이용자가 개인정보의 정정·삭제 또는 처리정지를 요청하면 관련 법령에 따라 지체 없이 조치합니다. 법령상 보관 의무 등으로 요청을 이행할 수 없는 경우에는 그 사유를 안내합니다.
                </p>
              </li>
              <li>통계정보의 이용
                <p className="ml-6 mt-2">
                  릴스탬프는 개인을 알아볼 수 없도록 익명처리한 통계정보를 서비스 이용 분석 및 개선에 활용할 수 있습니다. 가명처리된 정보 등 여전히 개인정보에 해당하는 정보는 관련 법령에 따라 처리합니다.
                </p>
              </li>
              <li>14세 미만 아동의 개인정보 처리
                <p className="ml-6 mt-2">
                  릴스탬프는 법정대리인의 동의가 필요한 14세 미만 아동의 회원가입을 허용하지 않습니다.
                </p>
              </li>
            </ol>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">제4조 (개인정보의 제공)</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              릴스탬프는 이용자의 사전 동의 없이 개인정보를 외부에 제공하지 않습니다. 단, 릴스탬프는 다음의 경우 관련 법령에 따라 이용자의 동의 없이도 제3자에게 개인정보를 제공할 수 있습니다.
            </p>
            <ol className="list-decimal list-inside space-y-2 text-gray-700">
              <li>법에 의거하여 적법한 절차에 의한 수사기관이나 기타 정부기관으로부터 정보제공을 요청받은 경우</li>
              <li>기타 법률에 의해 요구되는 경우</li>
            </ol>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">제5조 (개인정보 보유기간 및 파기)</h2>
            <ol className="list-decimal list-inside space-y-4 text-gray-700">
              <li>릴스탬프는 원칙적으로 수집·이용 목적이 달성되거나 보유기간이 종료되면 개인정보를 지체 없이 파기합니다. 다음 정보는 적법한 보유 근거가 있고 해당 기록이 실제 발생하는 경우에 한하여 별도로 보관합니다.
                <p className="font-semibold mt-4 mb-2">
                  관련 법령에 의한 사유
                </p>
                <ul className="list-disc list-inside ml-6 space-y-2 mb-4">
                  <li>계약 또는 청약 철회 등에 관한 기록
                    <ul className="list-circle list-inside ml-4 space-y-1">
                      <li>근거 법령 : 전자상거래 등에서의 소비자보호에 관한 법률</li>
                      <li>보유 기간 : 5년</li>
                    </ul>
                  </li>
                  <li>대금결제 및 재화 등의 공급에 관한 기록
                    <ul className="list-circle list-inside ml-4 space-y-1">
                      <li>근거 법령 : 전자상거래 등에서의 소비자보호에 관한 법률</li>
                      <li>보유 기간 : 5년</li>
                    </ul>
                  </li>
                  <li>이용자의 불만 또는 분쟁처리 기록
                    <ul className="list-circle list-inside ml-4 space-y-1">
                      <li>근거 법령 : 전자상거래 등에서의 소비자보호에 관한 법률</li>
                      <li>보유 기간 : 3년</li>
                    </ul>
                  </li>
                  <li>세법이 규정하는 모든 거래에 관한 장부 및 증빙서류
                    <ul className="list-circle list-inside ml-4 space-y-1">
                      <li>근거 법령 : 국세기본법</li>
                      <li>보유 기간 : 5년</li>
                    </ul>
                  </li>
                  <li>전자금융거래에 관한 기록
                    <ul className="list-circle list-inside ml-4 space-y-1">
                      <li>근거 법령 : 전자금융거래법</li>
                      <li>보유 기간 : 5년</li>
                    </ul>
                  </li>
                  <li>서비스 방문 기록
                    <ul className="list-circle list-inside ml-4 space-y-1">
                      <li>근거 법령 : 통신비밀보호법</li>
                      <li>보유 기간 : 3개월</li>
                    </ul>
                  </li>
                </ul>
              </li>
              <li>이용자의 동의 철회, 서비스 이용계약 종료 또는 회원 탈퇴 등으로 개인정보가 불필요하게 된 경우에는 지체 없이 파기합니다. 다만, 다른 법령에 따라 보존해야 하는 정보는 해당 기간 동안 다른 개인정보와 분리하여 보관한 후 파기합니다.</li>
              <li>종이에 출력된 개인정보는 분쇄기로 분쇄하거나 소각하여 파기하고, 전자적 파일 형태로 저장된 기록은 재생할 수 없는 기술적 방법을 사용하여 삭제합니다.</li>
              <li>릴스탬프는 「개인정보 보호법」 및 적용되는 관계 법령에 따른 개인정보 보관·파기 의무를 준수합니다.</li>
              <li>영상·편집정보·결과물의 보유 및 삭제
                <p className="ml-6 mt-2">
                  영상·편집정보·결과물에 포함된 개인정보는 편집 및 결과물 제공 목적이 달성되면 지체 없이 파기합니다. 이용자가 저장 기능을 이용하여 보관을 요청한 정보는 삭제 요청 또는 회원 탈퇴 시까지 보관하되, 관계 법령에 따른 보관 의무가 있는 경우에는 해당 기간 동안 분리하여 보관합니다. 이용자가 자신의 기기에 저장한 원본 및 결과물은 이용자가 직접 관리·삭제할 수 있습니다.
                </p>
              </li>
            </ol>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">제6조 (개인정보 처리 업무의 위탁)</h2>
            <ol className="list-decimal list-inside space-y-4 text-gray-700">
              <li>릴스탬프는 서비스 제공에 필요한 업무의 일부를 외부업체에 위탁할 수 있습니다. 위탁업무 및 수탁자는 다음과 같습니다.
                <ul className="list-disc list-inside ml-6 space-y-1 mt-2">
                  <li>네이버 주식회사: 간편 로그인</li>
                  <li>카카오 주식회사: 간편 로그인</li>
                  <li>카카오: 카카오 알림톡, 브랜드메시지 발송</li>
                  <li>주식회사 유디아이디(페이앱) : 전자지급결제대행 및 결제 취소·환불 처리</li>
                </ul>
              </li>
              <li>릴스탬프가 수탁업체에 위탁하고 있는 업무와 관련된 서비스를 이용하지 않는 경우에는 이용자의 개인정보가 수탁업체에 제공되지 않습니다.</li>
              <li>이와 관련하여, 릴스탬프는 위탁 받은 업체가 개인정보보호법에 따라 개인정보를 안전하게 처리하도록 필요한 사항을 규정하고 관리 및 감독을 하고 있습니다.</li>
              <li>릴스탬프는 그 밖에 추가적으로 제3자에게 개인정보 처리를 위탁하여야 하는 경우에 본 개인정보처리방침을 수정하여 이를 공개하는 등 법령상 필요한 조치를 취합니다.</li>
            </ol>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">제7조 (개인정보 국외 이전에 관한 사항)</h2>
            <ol className="list-decimal list-inside space-y-4 text-gray-700">
              <li>릴스탬프는 개인정보를 국외로 이전하는 경우 관련 법령에 따른 적법한 근거를 갖추고, 이전 항목, 국가, 시기 및 방법, 이전받는 자와 연락처, 목적, 보유·이용기간을 개인정보처리방침 또는 관련 동의 화면을 통하여 안내합니다.</li>
              <li>이용자는 고객지원 이메일을 통하여 개인정보 국외 이전에 관한 문의 또는 거부·동의 철회를 요청할 수 있습니다. 이 경우 이전의 법적 근거에 따라 필요한 조치를 취하고, 해당 이전이 필수적인 기능의 이용이 제한되는 경우에는 그 내용을 안내합니다.</li>
            </ol>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">제8조 (정보주체와 법정대리인의 권리 · 의무 및 행사방법)</h2>
            <ol className="list-decimal list-inside space-y-4 text-gray-700">
              <li>정보주체는 릴스탬프에 대하여 언제든지 개인정보의 열람, 정정, 삭제, 처리 정지 요구 등의 권리를 행사할 수 있습니다. 이러한 권리 행사는 릴스탬프의 이메일, 공식 홈페이지를 통하여 하실 수 있으며, 릴스탬프는 관련 법령 및 당사의 개인정보 민원 대응 매뉴얼에 따라 요구를 지체 없이 조치하겠습니다.</li>
              <li>단, 다른 법령에서 그 개인정보가 수집 대상으로 명시되어 있는 경우에는 그 삭제를 요구할 수 없습니다.</li>
              <li>본 조 제1항 및 제2항에 따른 권리는 법정대리인 또는 위임받은 대리인을 통하여 행사할 수 있습니다. 이 경우 릴스탬프는 본인 및 대리권 확인에 필요한 자료를 요청할 수 있습니다.</li>
            </ol>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">제9조 (개인정보 보호를 위한 기술적 관리적 대책)</h2>
            <ol className="list-decimal list-inside space-y-4 text-gray-700">
              <li>릴스탬프는 해킹이나 컴퓨터 바이러스 등에 의해 이용자 개인정보가 유출되거나 훼손되는 것을 막기 위해 최선을 다하고 있습니다.</li>
              <li>릴스탬프는 개인정보의 안전한 처리를 위하여 접근 권한 관리, 비밀번호 등 중요정보의 보호, 안전한 전송 및 무단 접근 방지 등 필요한 기술적·관리적 보호조치를 취합니다.</li>
              <li>개인정보를 처리하는 담당자를 필요한 범위로 제한하고, 담당자가 개인정보 보호 의무를 준수하도록 관리합니다.</li>
              <li>이용자는 계정과 비밀번호 등 본인의 개인정보를 안전하게 관리해야 합니다. 다만, 이용자의 부주의가 있다는 이유만으로 릴스탬프의 고의 또는 과실에 따른 법적 책임이 면제되는 것은 아닙니다.</li>
            </ol>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">제10조 (기타)</h2>
            <ol className="list-decimal list-inside space-y-4 text-gray-700">
              <li>정보주체의 권익침해에 대한 구제방법
                <p className="ml-6 mt-2">
                  릴스탬프는 개인정보보호와 관련하여 이용자의 의견을 수렴하고 있으며 불만을 처리하기 위하여 모든 절차와 방법을 마련하고 있습니다. 이용자는 릴스탬프의 개인정보 관리 책임자 및 담당자에게 불만사항을 신고할 수 있으며, 릴스탬프는 이용자의 신고사항에 대하여 신속하고도 충분한 답변을 해 드릴 것입니다. 또 정부에서 설치하여 운영 중인 아래의 기관에 불만을 처리할 수 있습니다.
                </p>
                <ul className="list-disc list-inside ml-6 space-y-1">
                  <li>개인정보분쟁조정위원회 : (국번없이) 1833-6972 (www.kopico.go.kr)</li>
                  <li>개인정보침해신고센터 : (국번없이) 118 (privacy.kisa.or.kr)</li>
                  <li>대검찰청 : (국번없이) 1301 (www.spo.go.kr)</li>
                  <li>경찰청 : (국번없이) 182 (ecrm.police.go.kr/minwon/main)</li>
                </ul>
              </li>
              <li>개인정보보호 책임자
                <p className="ml-6 mt-2">
                  개인정보를 보호하는데 있어 귀하께 고지한 사항들에 반하는 사고가 발생할 경우 개인정보관리 책임자가 그에 대한 후속처리 등 필요한 업무를 수행합니다. 릴스탬프는 개인정보에 대한 의견수렴 및 불만처리를 담당하는 개인정보 보호의 담당부서를 아래와 같이 지정하고 있습니다.
                </p>
                <ul className="list-disc list-inside ml-6 space-y-1 mt-2">
                  <li>부서명 : 릴스탬프 고객지원팀</li>
                  <li>연락처 : booquest55@gmail.com</li>
                </ul>
              </li>
            </ol>
          </section>

          <section className="mb-8">
            <p className="text-gray-700 leading-relaxed mb-4">
              법령, 정책 또는 보안기술의 변경, 기타 이 개인정보처리방침의 부칙 변경 등에 따라 이 개인정보처리방침의 내용의 추가, 삭제 및 변경이 있을 시에는 지체없이 당사 개인정보 처리방침 페이지를 통하여 고지합니다.
            </p>
            <p className="text-gray-700 leading-relaxed">
              본 개인정보처리방침의 시행일 및 변경사항은 서비스 내 공지를 통하여 안내합니다.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
