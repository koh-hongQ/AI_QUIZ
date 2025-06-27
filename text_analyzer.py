"""
PPT PDF 분석기 - 추출부터 분류까지 완전 통합 시스템
PyMuPDF를 사용한 텍스트 추출과 Y위치/크기 기반 분류를 통합
"""

import fitz  # PyMuPDF
import numpy as np
from sklearn.cluster import DBSCAN
from sklearn.neighbors import NearestNeighbors
from typing import List, Dict, Optional, Tuple, Union
import json
from pathlib import Path
from datetime import datetime
import warnings
warnings.filterwarnings('ignore', category=UserWarning)


class PPTPDFAnalyzer:
    """
    PPT 형식 PDF의 완전한 분석 시스템
    텍스트 추출부터 분류까지 통합 처리
    """
    
    def __init__(self, 
                 # 추출 관련 설정
                 min_text_length: int = 1,
                 merge_nearby_spans: bool = True,
                 nearby_threshold: float = 5.0,
                 # 분류 관련 설정
                 classification_method: str = "dual",  # "dual", "y_only", "size_only"
                 # 공통 설정
                 verbose: bool = False):
        """
        Args:
            min_text_length: 최소 텍스트 길이
            merge_nearby_spans: 인접 span 병합 여부
            nearby_threshold: span 병합 거리 임계값
            classification_method: 분류 방법 선택
            verbose: 상세 출력 여부
        """
        # 추출기 설정
        self.min_text_length = min_text_length
        self.merge_nearby_spans = merge_nearby_spans
        self.nearby_threshold = nearby_threshold
        
        # 분류기 설정
        self.classification_method = classification_method
        self.verbose = verbose
        
        # 충돌 해결 매트릭스
        self.decision_matrix = {
            ("title", "body"): lambda elem: "title" if elem["size"] > 20 else "body",
            ("title", "others"): lambda elem: "body",
            ("body", "title"): lambda elem: "title",
            ("body", "others"): lambda elem: "body",
            ("others", "title"): lambda elem: "body",
            ("others", "body"): lambda elem: "others"
        }
        
        # 통계 정보
        self.extraction_stats = {}
        self.classification_stats = {}
    
    def analyze_pdf(self, 
                   pdf_path: str, 
                   output_dir: Optional[str] = None,
                   save_intermediate: bool = True) -> Dict:
        """
        PDF 파일을 완전히 분석하는 메인 함수
        
        Args:
            pdf_path: PDF 파일 경로
            output_dir: 출력 디렉토리 (None이면 PDF와 같은 위치)
            save_intermediate: 중간 결과 저장 여부
        
        Returns:
            완전한 분석 결과
        """
        start_time = datetime.now()
        
        # 출력 디렉토리 설정
        if output_dir is None:
            output_dir = Path(pdf_path).parent / f"{Path(pdf_path).stem}_analysis"
        else:
            output_dir = Path(output_dir)
        output_dir.mkdir(exist_ok=True)
        
        if self.verbose:
            print(f"\n{'='*60}")
            print(f"PPT PDF 분석 시작: {Path(pdf_path).name}")
            print(f"출력 디렉토리: {output_dir}")
            print(f"{'='*60}")
        
        # 1단계: 텍스트 추출
        print("\n[1/3] 텍스트 추출 중...")
        elements = self._extract_text(pdf_path)
        
        if save_intermediate:
            self._save_json(elements, output_dir / "1_extracted_elements.json")
        
        # 2단계: 텍스트 분류
        print("\n[2/3] 텍스트 분류 중...")
        classified_result = self._classify_text(elements)
        
        if save_intermediate:
            self._save_json(classified_result, output_dir / "2_classified_result.json")
        
        # 3단계: 최종 분석 및 리포트 생성
        print("\n[3/3] 분석 리포트 생성 중...")
        final_report = self._generate_report(elements, classified_result, pdf_path)
        
        # 최종 리포트 저장
        self._save_json(final_report, output_dir / "final_report.json")
        self._save_summary_text(final_report, output_dir / "summary.txt")
        
        # 처리 시간
        processing_time = (datetime.now() - start_time).total_seconds()
        final_report["processing_time_seconds"] = round(processing_time, 2)
        
        if self.verbose:
            print(f"\n{'='*60}")
            print(f"분석 완료! 처리 시간: {processing_time:.2f}초")
            print(f"결과 저장 위치: {output_dir}")
            print(f"{'='*60}")
        
        return final_report
    
    # ===== 1단계: 텍스트 추출 =====
    
    def _extract_text(self, pdf_path: str) -> List[Dict]:
        """PDF에서 텍스트 추출"""
        if not Path(pdf_path).exists():
            raise FileNotFoundError(f"PDF 파일을 찾을 수 없습니다: {pdf_path}")
        
        try:
            doc = fitz.open(pdf_path)
        except Exception as e:
            raise Exception(f"PDF 파일을 열 수 없습니다: {e}")
        
        all_elements = []
        self.extraction_stats = {
            "total_pages": len(doc),
            "pages_with_text": 0,
            "total_blocks": 0,
            "total_spans": 0,
            "merged_spans": 0
        }
        
        for page_num in range(len(doc)):
            if self.verbose:
                print(f"  페이지 {page_num + 1}/{len(doc)} 처리 중...")
            
            page_elements = self._extract_from_page(doc[page_num], page_num + 1)
            if page_elements:
                self.extraction_stats["pages_with_text"] += 1
                all_elements.extend(page_elements)
        
        doc.close()
        
        print(f"  → {len(all_elements)}개의 텍스트 요소 추출 완료")
        return all_elements
    
    def _extract_from_page(self, page: fitz.Page, page_num: int) -> List[Dict]:
        """단일 페이지에서 텍스트 추출"""
        text_dict = page.get_text("dict")
        elements = []
        
        for block in text_dict["blocks"]:
            if block["type"] != 0:  # 텍스트 블록만
                continue
            
            self.extraction_stats["total_blocks"] += 1
            
            for line in block["lines"]:
                line_spans = []
                
                for span in line["spans"]:
                    self.extraction_stats["total_spans"] += 1
                    
                    text = self._clean_text(span["text"])
                    if len(text) < self.min_text_length:
                        continue
                    
                    bbox = self._convert_bbox(span["bbox"])
                    
                    span_info = {
                        "text": text,
                        "bbox": bbox,
                        "size": round(span["size"], 1),
                        "flags": span["flags"],
                        "font": span["font"],
                    }
                    
                    line_spans.append(span_info)
                
                # Span 병합
                if self.merge_nearby_spans and len(line_spans) > 1:
                    original_count = len(line_spans)
                    merged_spans = self._merge_line_spans(line_spans)
                    self.extraction_stats["merged_spans"] += original_count - len(merged_spans)
                else:
                    merged_spans = line_spans
                
                # 요소 생성
                for span in merged_spans:
                    element = {
                        "page": page_num,
                        "text": span["text"],
                        "bbox": span["bbox"],
                        "size": span["size"],
                        # 추가 메타데이터
                        "font": span.get("font", "unknown"),
                        "is_bold": bool(span.get("flags", 0) & 2**4),
                        "is_italic": bool(span.get("flags", 0) & 2**1)
                    }
                    elements.append(element)
        
        return elements
    
    def _clean_text(self, text: str) -> str:
        """텍스트 정리"""
        text = text.strip()
        text = " ".join(text.split())
        return text
    
    def _convert_bbox(self, bbox: Tuple[float, float, float, float]) -> List[float]:
        """bbox 형식 변환"""
        x0, y0, x1, y1 = bbox
        return [round(x0, 1), round(y0, 1), round(x1 - x0, 1), round(y1 - y0, 1)]
    
    def _merge_line_spans(self, spans: List[Dict]) -> List[Dict]:
        """인접 span 병합"""
        if not spans:
            return []
        
        spans.sort(key=lambda s: s["bbox"][0])
        merged = []
        current = spans[0].copy()
        
        for i in range(1, len(spans)):
            span = spans[i]
            
            if self._should_merge_spans(current, span):
                current["text"] += " " + span["text"]
                current["bbox"][2] = (span["bbox"][0] + span["bbox"][2]) - current["bbox"][0]
                current["bbox"][3] = max(current["bbox"][3], span["bbox"][3])
                current["size"] = max(current["size"], span["size"])
            else:
                merged.append(current)
                current = span.copy()
        
        merged.append(current)
        return merged
    
    def _should_merge_spans(self, span1: Dict, span2: Dict) -> bool:
        """span 병합 여부 판단"""
        size_diff = abs(span1["size"] - span2["size"])
        if size_diff > 2:
            return False
        
        gap = span2["bbox"][0] - (span1["bbox"][0] + span1["bbox"][2])
        if gap > self.nearby_threshold:
            return False
        
        y_diff = abs(span1["bbox"][1] - span2["bbox"][1])
        if y_diff > 5:
            return False
        
        return True
    
    # ===== 2단계: 텍스트 분류 =====
    
    def _classify_text(self, elements: List[Dict]) -> Dict:
        """추출된 텍스트를 분류"""
        if not elements:
            return {"pages": [], "summary": {"total_pages": 0}}
        
        pages = self._group_by_page(elements)
        classified_results = []
        total_stats = {"title": 0, "body": 0, "others": 0}
        
        # 분류 방법별 통계
        method_stats = {
            "dbscan_success": {"y": 0, "size": 0},
            "gap_success": {"y": 0, "size": 0},
            "failed": 0
        }
        
        for page_num in sorted(pages.keys()):
            page_elements = pages[page_num]
            
            if self.verbose:
                print(f"  페이지 {page_num} 분류 중 (요소: {len(page_elements)}개)")
            
            page_result = self._classify_page(page_num, page_elements, method_stats)
            
            if page_result:
                classified_results.append(page_result)
                total_stats["title"] += len(page_result["title"])
                total_stats["body"] += len(page_result["body"])
                total_stats["others"] += len(page_result["others"])
        
        self.classification_stats = {
            "method_stats": method_stats,
            "element_stats": total_stats
        }
        
        print(f"  → 분류 완료: 제목 {total_stats['title']}개, "
              f"본문 {total_stats['body']}개, 기타 {total_stats['others']}개")
        
        return {
            "pages": classified_results,
            "summary": {
                "total_pages": len(classified_results),
                "total_elements": sum(total_stats.values()),
                "statistics": total_stats
            }
        }
    
    def _group_by_page(self, elements: List[Dict]) -> Dict[int, List[Dict]]:
        """페이지별 그룹화"""
        pages = {}
        for elem in elements:
            page_num = elem.get("page", 0)
            if page_num not in pages:
                pages[page_num] = []
            pages[page_num].append(elem)
        return pages
    
    def _classify_page(self, page_num: int, elements: List[Dict], 
                      method_stats: Dict) -> Optional[Dict]:
        """페이지 분류"""
        if len(elements) < 3:
            method_stats["failed"] += 1
            return {
                "page": page_num,
                "title": [],
                "body": [elem["text"] for elem in elements],
                "others": [],
                "classification_method": "insufficient_elements"
            }
        
        # 분류 방법에 따라 처리
        if self.classification_method == "y_only":
            return self._classify_by_y_only(page_num, elements, method_stats)
        elif self.classification_method == "size_only":
            return self._classify_by_size_only(page_num, elements, method_stats)
        else:  # dual
            return self._classify_by_dual(page_num, elements, method_stats)
    
    def _classify_by_dual(self, page_num: int, elements: List[Dict], 
                         method_stats: Dict) -> Dict:
        """Y 위치와 크기를 모두 고려한 분류"""
        # Y 위치 분석
        y_boundaries = self._find_y_boundaries(elements)
        if y_boundaries and "method" in y_boundaries:
            method_stats[f"{y_boundaries['method']}_success"]["y"] += 1
        
        # 크기 분석
        size_boundaries = self._find_size_boundaries(elements)
        if size_boundaries and "method" in size_boundaries:
            method_stats[f"{size_boundaries['method']}_success"]["size"] += 1
        
        # 분류 수행
        classified = self._classify_with_dual_criteria(
            elements, y_boundaries, size_boundaries
        )
        
        # 결과 정리
        title_texts = []
        body_texts = []
        others_texts = []
        
        for item in classified:
            if item["final_class"] == "title":
                title_texts.append(item["element"]["text"])
            elif item["final_class"] == "body":
                body_texts.append(item["element"]["text"])
            else:
                others_texts.append(item["element"]["text"])
        
        avg_confidence = np.mean([item["confidence"] for item in classified])
        
        return {
            "page": page_num,
            "title": title_texts,
            "body": body_texts,
            "others": others_texts,
            "classification_method": {
                "type": "dual",
                "y_method": y_boundaries.get("method", "none") if y_boundaries else "none",
                "size_method": size_boundaries.get("method", "none") if size_boundaries else "none",
                "avg_confidence": round(avg_confidence, 2)
            }
        }
    
    def _find_y_boundaries(self, elements: List[Dict]) -> Optional[Dict[str, float]]:
        """Y 위치 기반 구획선 찾기"""
        boundaries = self._find_y_boundaries_dbscan(elements)
        if boundaries:
            boundaries["method"] = "dbscan"
            return boundaries
        
        boundaries = self._find_y_boundaries_gap(elements)
        if boundaries:
            boundaries["method"] = "gap"
            return boundaries
        
        return None
    
    def _find_y_boundaries_dbscan(self, elements: List[Dict]) -> Optional[Dict[str, float]]:
        """Y DBSCAN - 기존 출력 형식 유지하면서 엣지 케이스 처리"""
        
        # 기본 유효성 검사
        if len(elements) < 3:
            return None
        
        # bbox 유효성 검사
        import math
        valid_elements = []
        for elem in elements:
            try:
                bbox = elem.get("bbox", [])
                if (len(bbox) >= 4 and 
                    all(isinstance(x, (int, float)) for x in bbox) and
                    all(not math.isnan(x) for x in bbox) and
                    bbox[1] >= 0 and bbox[3] > 0):
                    valid_elements.append(elem)
            except:
                continue
        
        if len(valid_elements) < 3:
            return None
        
        # 기존 로직 그대로
        y_positions = [elem["bbox"][1] for elem in valid_elements]
        y_array = np.array(y_positions).reshape(-1, 1)
        
        # ===== 개선된 정규화 추가 (옵션) =====
        if hasattr(self, 'use_content_normalization') and self.use_content_normalization:
            # 콘텐츠 기반 정규화
            content_top = min(y_positions)
            content_bottom = max(elem["bbox"][1] + elem["bbox"][3] for elem in valid_elements)
            content_height = content_bottom - content_top
            
            if content_height < 10:  # 너무 작으면 기존 방식 사용
                page_height = max(elem["bbox"][1] + elem["bbox"][3] for elem in elements)
                y_normalized = y_array / page_height
            else:
                y_normalized = (y_array - content_top) / content_height
        else:
            # 기존 방식 (기본값)
            page_height = max(elem["bbox"][1] + elem["bbox"][3] for elem in elements)
            y_normalized = y_array / page_height
        # ===== 개선 끝 =====
        
        # 기존 DBSCAN 로직
        eps = self._calculate_adaptive_eps(y_normalized)
        clustering = DBSCAN(eps=eps, min_samples=2).fit(y_normalized)
        
        unique_labels = set(clustering.labels_)
        unique_labels.discard(-1)
        
        # 기존과 동일한 조건
        if len(unique_labels) != 3:
            return None
        
        # 기존과 동일한 클러스터 정보 수집
        cluster_info = []
        for label in unique_labels:
            cluster_indices = np.where(clustering.labels_ == label)[0]
            cluster_y = [y_positions[i] for i in cluster_indices]
            
            cluster_info.append({
                "min": min(cluster_y),
                "max": max(cluster_y),
                "center": np.mean(cluster_y),
                "count": len(cluster_y)
            })
        
        cluster_info.sort(key=lambda x: x["center"])
        
        # 기존과 동일한 출력 형식
        return {
            "upper": (cluster_info[0]["max"] + cluster_info[1]["min"]) / 2,
            "lower": (cluster_info[1]["max"] + cluster_info[2]["min"]) / 2
        }
    
    def _find_y_boundaries_gap(self, elements: List[Dict]) -> Optional[Dict[str, float]]:
        """Y Gap"""
        sorted_elements = sorted(elements, key=lambda x: x["bbox"][1])
        
        gaps = []
        for i in range(1, len(sorted_elements)):
            curr_y = sorted_elements[i]["bbox"][1]
            prev_y_bottom = sorted_elements[i-1]["bbox"][1] + sorted_elements[i-1]["bbox"][3]
            gap = curr_y - prev_y_bottom
            
            if gap > 0:
                gaps.append({
                    "gap": gap,
                    "position": (prev_y_bottom + curr_y) / 2
                })
        
        if len(gaps) < 2:
            return None
        
        gaps.sort(key=lambda x: x["gap"], reverse=True)
        top_gaps = gaps[:2]
        top_gaps.sort(key=lambda x: x["position"])
        
        page_height = max(elem["bbox"][1] + elem["bbox"][3] for elem in elements)
        min_gap = page_height * 0.02
        
        if all(g["gap"] > min_gap for g in top_gaps):
            return {
                "upper": top_gaps[0]["position"],
                "lower": top_gaps[1]["position"]
            }
        
        return None
    
    def _find_size_boundaries(self, elements: List[Dict]) -> Optional[Dict[str, float]]:
        """크기 기반 임계값 찾기"""
        boundaries = self._find_size_boundaries_dbscan(elements)
        if boundaries:
            boundaries["method"] = "dbscan"
            return boundaries
        
        boundaries = self._find_size_boundaries_gap(elements)
        if boundaries:
            boundaries["method"] = "gap"
            return boundaries
        
        return None
    
    def _find_size_boundaries_dbscan(self, elements: List[Dict]) -> Optional[Dict[str, float]]:
        """Size DBSCAN"""
        sizes = [elem["size"] for elem in elements]
        size_array = np.array(sizes).reshape(-1, 1)
        
        size_range = max(sizes) - min(sizes)
        if size_range == 0:
            return None
        
        size_normalized = (size_array - min(sizes)) / size_range
        eps = self._calculate_adaptive_eps(size_normalized, k=2, percentile=75)
        
        clustering = DBSCAN(eps=eps, min_samples=2).fit(size_normalized)
        
        unique_labels = set(clustering.labels_)
        unique_labels.discard(-1)
        
        if len(unique_labels) != 3:
            return None
        
        cluster_info = []
        for label in unique_labels:
            cluster_indices = np.where(clustering.labels_ == label)[0]
            cluster_sizes = [sizes[i] for i in cluster_indices]
            
            cluster_info.append({
                "min": min(cluster_sizes),
                "max": max(cluster_sizes),
                "mean": np.mean(cluster_sizes),
                "count": len(cluster_sizes)
            })
        
        cluster_info.sort(key=lambda x: x["mean"])
        
        return {
            "small_threshold": (cluster_info[0]["max"] + cluster_info[1]["min"]) / 2,
            "large_threshold": (cluster_info[1]["max"] + cluster_info[2]["min"]) / 2
        }
    
    def _find_size_boundaries_gap(self, elements: List[Dict]) -> Optional[Dict[str, float]]:
        """Size Gap"""
        sizes = sorted(set(elem["size"] for elem in elements))
        
        if len(sizes) < 3:
            return None
        
        gaps = []
        for i in range(1, len(sizes)):
            relative_gap = (sizes[i] - sizes[i-1]) / sizes[i-1]
            gaps.append({
                "gap": relative_gap,
                "position": (sizes[i] + sizes[i-1]) / 2
            })
        
        if len(gaps) < 2:
            return None
        
        gaps.sort(key=lambda x: x["gap"], reverse=True)
        top_gaps = gaps[:2]
        top_gaps.sort(key=lambda x: x["position"])
        
        return {
            "small_threshold": top_gaps[0]["position"],
            "large_threshold": top_gaps[1]["position"]
        }
    
    def _calculate_adaptive_eps(self, data: np.ndarray, k: int = 3, percentile: int = 90) -> float:
        """적응적 eps 계산"""
        if len(data) < k + 1:
            return 0.1
        
        nbrs = NearestNeighbors(n_neighbors=min(k + 1, len(data))).fit(data)
        distances, _ = nbrs.kneighbors(data)
        k_distances = np.sort(distances[:, -1])
        eps = np.percentile(k_distances, percentile)
        
        return np.clip(eps, 0.05, 0.15)
    
    def _classify_with_dual_criteria(self, elements: List[Dict], 
                                   y_boundaries: Optional[Dict], 
                                   size_boundaries: Optional[Dict]) -> List[Dict]:
        """이중 기준 분류"""
        classified = []
        
        for elem in elements:
            y_class = self._get_y_class(elem, y_boundaries)
            size_class = self._get_size_class(elem, size_boundaries)
            final_class = self._determine_final_class(y_class, size_class, elem)
            confidence = self._calculate_confidence(y_class, size_class)
            
            classified.append({
                "element": elem,
                "y_class": y_class,
                "size_class": size_class,
                "final_class": final_class,
                "confidence": confidence
            })
        
        return classified
    
    def _get_y_class(self, elem: Dict, boundaries: Optional[Dict]) -> str:
        """Y 기반 분류"""
        if not boundaries:
            return "body"
        
        y_pos = elem["bbox"][1]
        if y_pos < boundaries["upper"]:
            return "title"
        elif y_pos >= boundaries["lower"]:
            return "others"
        else:
            return "body"
    
    def _get_size_class(self, elem: Dict, boundaries: Optional[Dict]) -> str:
        """크기 기반 분류"""
        if not boundaries:
            return "body"
        
        size = elem["size"]
        if size >= boundaries["large_threshold"]:
            return "title"
        elif size <= boundaries["small_threshold"]:
            return "others"
        else:
            return "body"
    
    def _determine_final_class(self, y_class: str, size_class: str, elem: Dict) -> str:
        """최종 분류 결정"""
        if y_class == size_class:
            return y_class
        
        key = (y_class, size_class)
        if key in self.decision_matrix:
            return self.decision_matrix[key](elem)
        
        return "body"
    
    def _calculate_confidence(self, y_class: str, size_class: str) -> float:
        """신뢰도 계산"""
        if y_class == size_class:
            return 1.0
        elif (y_class, size_class) in [("title", "body"), ("body", "title")]:
            return 0.7
        else:
            return 0.4
    
    # ===== 3단계: 리포트 생성 =====
    
    def _generate_report(self, elements: List[Dict], 
                        classified_result: Dict, 
                        pdf_path: str) -> Dict:
        """최종 분석 리포트 생성"""
        report = {
            "file_info": {
                "path": str(Path(pdf_path).absolute()),
                "name": Path(pdf_path).name,
                "size_bytes": Path(pdf_path).stat().st_size,
                "analyzed_at": datetime.now().isoformat()
            },
            "extraction_summary": self.extraction_stats,
            "classification_summary": self.classification_stats,
            "classified_content": classified_result,
            "insights": self._generate_insights(elements, classified_result)
        }
        
        return report
    
    def _generate_insights(self, elements: List[Dict], classified_result: Dict) -> Dict:
        """인사이트 생성"""
        insights = {
            "font_size_analysis": self._analyze_font_sizes(elements),
            "layout_consistency": self._analyze_layout_consistency(classified_result),
            "content_distribution": self._analyze_content_distribution(classified_result),
            "recommendations": []
        }
        
        # 권장사항 생성
        if insights["font_size_analysis"]["size_variance"] > 15:
            insights["recommendations"].append(
                "폰트 크기 변동이 큽니다. 일관된 스타일 가이드 적용을 권장합니다."
            )
        
        if insights["layout_consistency"]["consistency_score"] < 0.7:
            insights["recommendations"].append(
                "페이지 간 레이아웃 일관성이 낮습니다. 템플릿 사용을 고려하세요."
            )
        
        return insights
    
    def _analyze_font_sizes(self, elements: List[Dict]) -> Dict:
        """폰트 크기 분석"""
        sizes = [e["size"] for e in elements]
        
        return {
            "min_size": min(sizes),
            "max_size": max(sizes),
            "mean_size": round(np.mean(sizes), 1),
            "size_variance": round(np.std(sizes), 1),
            "unique_sizes": len(set(sizes)),
            "size_distribution": self._get_size_distribution(sizes)
        }
    
    def _get_size_distribution(self, sizes: List[float]) -> Dict[str, int]:
        """크기 분포 계산"""
        distribution = {}
        for size in sizes:
            size_group = f"{int(size // 5) * 5}-{int(size // 5) * 5 + 4}"
            distribution[size_group] = distribution.get(size_group, 0) + 1
        return dict(sorted(distribution.items()))
    
    def _analyze_layout_consistency(self, classified_result: Dict) -> Dict:
        """레이아웃 일관성 분석"""
        pages = classified_result["pages"]
        
        if len(pages) < 2:
            return {"consistency_score": 1.0, "details": "페이지가 1개뿐입니다."}
        
        # 각 페이지의 구조 비교
        structures = []
        for page in pages:
            structure = {
                "has_title": len(page["title"]) > 0,
                "title_count": len(page["title"]),
                "body_ratio": len(page["body"]) / (len(page["title"]) + len(page["body"]) + len(page["others"]) + 1)
            }
            structures.append(structure)
        
        # 일관성 점수 계산
        title_consistency = sum(s["has_title"] for s in structures) / len(structures)
        body_ratio_variance = np.std([s["body_ratio"] for s in structures])
        
        consistency_score = title_consistency * (1 - body_ratio_variance)
        
        return {
            "consistency_score": round(consistency_score, 2),
            "pages_with_title": sum(s["has_title"] for s in structures),
            "average_body_ratio": round(np.mean([s["body_ratio"] for s in structures]), 2)
        }
    
    def _analyze_content_distribution(self, classified_result: Dict) -> Dict:
        """콘텐츠 분포 분석"""
        stats = classified_result["summary"]["statistics"]
        total = sum(stats.values())
        
        return {
            "title_percentage": round(stats["title"] / total * 100, 1),
            "body_percentage": round(stats["body"] / total * 100, 1),
            "others_percentage": round(stats["others"] / total * 100, 1),
            "average_per_page": {
                "title": round(stats["title"] / len(classified_result["pages"]), 1),
                "body": round(stats["body"] / len(classified_result["pages"]), 1),
                "others": round(stats["others"] / len(classified_result["pages"]), 1)
            }
        }
    
    # ===== 유틸리티 함수 =====
    
    def _save_json(self, data: Dict, filepath: Path):
        """JSON 저장"""
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    
    def _save_summary_text(self, report: Dict, filepath: Path):
        """텍스트 요약 저장"""
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write("PPT PDF 분석 요약\n")
            f.write("=" * 50 + "\n\n")
            
            # 파일 정보
            f.write(f"파일명: {report['file_info']['name']}\n")
            f.write(f"분석 시간: {report['file_info']['analyzed_at']}\n\n")
            
            # 추출 요약
            ext = report['extraction_summary']
            f.write("텍스트 추출 결과:\n")
            f.write(f"- 전체 페이지: {ext['total_pages']}개\n")
            f.write(f"- 텍스트 있는 페이지: {ext['pages_with_text']}개\n")
            f.write(f"- 추출된 텍스트 블록: {ext['total_blocks']}개\n")
            f.write(f"- 병합된 span: {ext['merged_spans']}개\n\n")
            
            # 분류 요약
            cls = report['classification_summary']['element_stats']
            f.write("텍스트 분류 결과:\n")
            f.write(f"- 제목: {cls['title']}개\n")
            f.write(f"- 본문: {cls['body']}개\n")
            f.write(f"- 기타: {cls['others']}개\n\n")
            
            # 인사이트
            insights = report['insights']
            f.write("주요 인사이트:\n")
            f.write(f"- 폰트 크기 범위: {insights['font_size_analysis']['min_size']:.1f} - "
                   f"{insights['font_size_analysis']['max_size']:.1f} pt\n")
            f.write(f"- 레이아웃 일관성 점수: {insights['layout_consistency']['consistency_score']:.2f}\n")
            f.write(f"- 본문 비중: {insights['content_distribution']['body_percentage']:.1f}%\n\n")
            
            # 권장사항
            if insights['recommendations']:
                f.write("권장사항:\n")
                for rec in insights['recommendations']:
                    f.write(f"- {rec}\n")


# ===== 간편 사용 함수 =====

def analyze_ppt_pdf(pdf_path: str, 
                   output_dir: Optional[str] = None,
                   verbose: bool = True,
                   **kwargs) -> Dict:
    """
    PPT PDF 파일을 간편하게 분석하는 함수
    
    Args:
        pdf_path: PDF 파일 경로
        output_dir: 출력 디렉토리 (기본: PDF와 같은 위치)
        verbose: 상세 출력 여부
        **kwargs: PPTPDFAnalyzer의 추가 옵션
    
    Returns:
        분석 결과 딕셔너리
    """
    analyzer = PPTPDFAnalyzer(verbose=verbose, **kwargs)
    return analyzer.analyze_pdf(pdf_path, output_dir)


def batch_analyze(pdf_folder: str, 
                 output_base_dir: str = "analysis_results",
                 file_pattern: str = "*.pdf",
                 verbose: bool = False) -> Dict[str, Dict]:
    """
    여러 PDF 파일을 일괄 분석
    
    Args:
        pdf_folder: PDF 파일들이 있는 폴더
        output_base_dir: 결과를 저장할 기본 디렉토리
        file_pattern: 파일 패턴 (기본: *.pdf)
        verbose: 상세 출력 여부
    
    Returns:
        파일별 분석 결과
    """
    from pathlib import Path
    import glob
    
    pdf_files = list(Path(pdf_folder).glob(file_pattern))
    
    if not pdf_files:
        print(f"경로 '{pdf_folder}'에서 '{file_pattern}' 파일을 찾을 수 없습니다.")
        return {}
    
    print(f"{len(pdf_files)}개 파일 분석 시작...")
    
    results = {}
    analyzer = PPTPDFAnalyzer(verbose=verbose)
    
    for i, pdf_path in enumerate(pdf_files, 1):
        print(f"\n[{i}/{len(pdf_files)}] {pdf_path.name} 분석 중...")
        
        try:
            output_dir = Path(output_base_dir) / pdf_path.stem
            result = analyzer.analyze_pdf(str(pdf_path), str(output_dir))
            results[str(pdf_path)] = result
            print(f"  → 성공")
        except Exception as e:
            print(f"  → 실패: {e}")
            results[str(pdf_path)] = {"error": str(e)}
    
    # 전체 요약 저장
    summary_path = Path(output_base_dir) / "batch_summary.json"
    with open(summary_path, 'w', encoding='utf-8') as f:
        json.dump({
            "total_files": len(pdf_files),
            "successful": sum(1 for r in results.values() if "error" not in r),
            "failed": sum(1 for r in results.values() if "error" in r),
            "files": {Path(k).name: {"status": "error" if "error" in v else "success"} 
                     for k, v in results.items()}
        }, f, ensure_ascii=False, indent=2)
    
    print(f"\n분석 완료! 요약: {summary_path}")
    return results


# ===== 사용 예시 =====

if __name__ == "__main__":
    # 1. 단일 파일 분석
    print("=== 단일 파일 분석 예시 ===")
    result = analyze_ppt_pdf(
        "example.pdf",
        output_dir="./analysis_output",
        verbose=True,
        classification_method="dual"  # "dual", "y_only", "size_only"
    )
    
    # 2. 분석 결과 확인
    print("\n=== 분석 결과 요약 ===")
    print(f"총 페이지: {result['extraction_summary']['total_pages']}")
    print(f"추출된 텍스트: {sum(result['classification_summary']['element_stats'].values())}")
    print(f"레이아웃 일관성: {result['insights']['layout_consistency']['consistency_score']}")
    
    # 3. 배치 분석 (폴더 내 모든 PDF)
    # batch_results = batch_analyze(
    #     pdf_folder="./pdf_files",
    #     output_base_dir="./batch_analysis",
    #     verbose=False
    # )