'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, X } from 'lucide-react';

export default function EditProfileClient() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    category: '카페',
    customCategory: '',
    brandName: '릴스탬프',
    mainContent: '마케팅 릴스 제작 서비스',
    ageTargets: ['2030'] as string[],
    genderTargets: ['여성', '남성'] as string[],
    spaceImages: [] as string[],
  });

  const categories = ['식당', '카페', '뷰티', '패션', '헬스', '교육', '의료', '라이프스타일', '서비스', 'IT(플랫폼)', '기타'];
  const ageTargets = ['10대', '2030', '4050', '60대 이상'];
  const genderTargets = ['여성', '남성'];

  const handleCategorySelect = (category: string) => {
    setFormData({ ...formData, category });
  };

  const handleAgeTargetToggle = (target: string) => {
    const newTargets = formData.ageTargets.includes(target)
      ? formData.ageTargets.filter((t) => t !== target)
      : [...formData.ageTargets, target];
    setFormData({ ...formData, ageTargets: newTargets });
  };

  const handleGenderTargetToggle = (target: string) => {
    const newTargets = formData.genderTargets.includes(target)
      ? formData.genderTargets.filter((t) => t !== target)
      : [...formData.genderTargets, target];
    setFormData({ ...formData, genderTargets: newTargets });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newImages = Array.from(files)
        .slice(0, 3 - formData.spaceImages.length)
        .map((file) => URL.createObjectURL(file));
      setFormData({ ...formData, spaceImages: [...formData.spaceImages, ...newImages] });
    }
  };

  const removeImage = (index: number) => {
    const newImages = formData.spaceImages.filter((_, i) => i !== index);
    setFormData({ ...formData, spaceImages: newImages });
  };

  const handleSave = () => {
    router.push('/account-settings');
  };

  return (
    <div className="min-h-[calc(100vh-80px)] bg-gradient-to-b from-pink-50 to-white pb-24">
      <div className="max-w-md mx-auto px-4 py-6">
        <div className="space-y-6">
          {/* 카테고리 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900">카테고리</span>
              <span className="text-[#FF496D]">*</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => handleCategorySelect(cat)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    formData.category === cat
                      ? 'bg-[#FF496D] text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
            {formData.category === '기타' && (
              <input
                type="text"
                placeholder="직접 입력..."
                value={formData.customCategory}
                onChange={(e) => setFormData({ ...formData, customCategory: e.target.value })}
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF496D]/20 focus:border-[#FF496D] placeholder:text-sm"
              />
            )}
          </div>

          {/* 홍보 대상 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900">홍보 대상</span>
              <span className="text-[#FF496D]">*</span>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  무엇을 알릴 건가요?
                </label>
                <input
                  type="text"
                  placeholder="브랜드/서비스명 ex. 릴스탬프"
                  value={formData.brandName}
                  onChange={(e) => setFormData({ ...formData, brandName: e.target.value })}
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF496D]/20 focus:border-[#FF496D] placeholder:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  핵심 홍보 내용
                </label>
                <textarea
                  placeholder="핵심 홍보 내용 ex. 돼지고기, 케이크, 인테리어 시공"
                  value={formData.mainContent}
                  onChange={(e) => setFormData({ ...formData, mainContent: e.target.value })}
                  maxLength={300}
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF496D]/20 focus:border-[#FF496D] resize-none placeholder:text-sm"
                  rows={2}
                />
              </div>
            </div>
          </div>

          {/* 핵심 타겟 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900">핵심 타겟</span>
              <span className="text-gray-400 text-sm">(복수 선택)</span>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-2">나이</p>
              <div className="flex flex-wrap gap-2">
                {ageTargets.map((target) => (
                  <button
                    key={target}
                    onClick={() => handleAgeTargetToggle(target)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                      formData.ageTargets.includes(target)
                        ? 'bg-[#FF496D] text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                    }`}
                  >
                    {target}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-2">성별</p>
              <div className="flex flex-wrap gap-2">
                {genderTargets.map((target) => (
                  <button
                    key={target}
                    onClick={() => handleGenderTargetToggle(target)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                      formData.genderTargets.includes(target)
                        ? 'bg-[#FF496D] text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                    }`}
                  >
                    {target}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 촬영 공간 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900">촬영 공간</span>
              <span className="text-gray-400 text-sm">(선택)</span>
            </div>
            <p className="text-sm text-gray-500">
              촬영을 진행할 매장의 전체적인 무드를 알 수 있는 사진을 업로드해주세요 (최대 3장)
            </p>

            <div className="grid grid-cols-3 gap-2">
              {formData.spaceImages.map((img, index) => (
                <div key={index} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
                  <img src={img} alt={`공간 ${index + 1}`} className="w-full h-full object-cover" />
                  <button
                    onClick={() => removeImage(index)}
                    className="absolute top-1 right-1 w-6 h-6 bg-black/50 rounded-full flex items-center justify-center"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
              ))}

              {formData.spaceImages.length < 3 && (
                <label className="aspect-square rounded-lg border-2 border-dashed border-gray-300 bg-white flex flex-col items-center justify-center cursor-pointer hover:border-[#FF496D] hover:bg-pink-50 transition-all">
                  <Upload className="w-6 h-6 text-gray-400 mb-1" />
                  <span className="text-xs text-gray-500">업로드</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4">
        <div className="max-w-md mx-auto">
          <button
            onClick={handleSave}
            className="w-full py-4 bg-[#FF496D] text-white rounded-full font-semibold hover:bg-[#FF496D]/90 transition-all"
          >
            저장하기
          </button>
        </div>
      </div>
    </div>
  );
}
