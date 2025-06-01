"""
LangChain Pipeline for PDF Analysis with Gemini 2.0 Flash
Two-stage LLM processing:
1. Reclassification & Restructuring (분류 및 재구성)
2. Content Augmentation (내용 보강)
"""

import os
import json
import shutil
from pathlib import Path
from typing import Dict, Any, List
from dotenv import load_dotenv

# LangChain imports
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.prompts import ChatPromptTemplate
from langchain.schema import HumanMessage, SystemMessage

# Import the text analyzer
from text_analyzer import analyze_ppt_pdf

# Load environment variables
load_dotenv()


class PDFAnalysisLangChainPipeline:
    """Pipeline for analyzing PDF and processing with Gemini"""
    
    def __init__(self, google_api_key: str = None):
        """Initialize the pipeline with API key"""
        self.api_key = google_api_key or os.getenv("GOOGLE_API_KEY")
        if not self.api_key:
            raise ValueError("Google API key not found. Please set GOOGLE_API_KEY environment variable.")
        
        # Initialize Gemini model
        self.llm = ChatGoogleGenerativeAI(
            model="gemini-2.0-flash-exp",
            google_api_key=self.api_key,
            temperature=0.7,
            max_output_tokens=8192
        )
        
        # Stage 1 prompt - Reclassification only
        self.reclassification_prompt = """## 지시: PDF 보고서 페이지 내용의 엄격한 재분류 및 재구성

다음은 PDF 보고서에서 추출되어 초기 처리된 페이지별 내용입니다.
각 페이지의 title, body, others를 정확하게 재분류해주세요.

### 분류 기준:
1. title: 페이지의 핵심 주제를 나타내는 간결한 제목
2. body: 실제 내용에 해당하는 모든 텍스트 (원본 그대로 유지하되, 자연스러운 문장으로 연결)
3. others: 페이지 번호, 날짜, 소속, 메타데이터 등

중요: 이 단계에서는 내용을 보강하지 마세요. 원본 텍스트를 정확하게 분류하고 자연스럽게 연결하는 것에만 집중하세요.

출력은 다음 JSON 형식으로 제공하세요:
{
  "reclassified_pages": [
    {
      "page": 페이지번호,
      "title": "페이지 제목",
      "body": "분류된 본문 내용",
      "others": ["메타데이터1", "메타데이터2"]
    }
  ]
}"""

        # Stage 2 prompt - Content augmentation
        self.augmentation_prompt = """## 지시: PDF 보고서 페이지 본문 내용의 보강

다음은 재분류된 페이지의 body 내용입니다. 이 내용을 보강해주세요.

### 보강 요구사항:
1. 원본 body 텍스트를 단 한 글자도 삭제하거나 변경하지 마세요.
2. 원본 텍스트 뒤에 해당 개념이나 내용을 충분히 이해할 수 있도록 상세한 설명을 추가하세요.
3. 마치 해당 주제를 처음부터 설명하는 것처럼 자연스럽고 포괄적인 문장으로 구성하세요.
4. 모든 내용은 문어체로 자연스럽게 연결되어야 합니다.

중요: 보강된 body 텍스트만 반환하세요. JSON 형식이나 다른 메타데이터는 포함하지 마세요."""
    
    def analyze_pdf(self, pdf_path: str = "example.pdf", output_dir: str = None) -> Dict[str, Any]:
        """
        Step 1: Analyze PDF using text_analyzer.py
        
        Args:
            pdf_path: Path to the PDF file
            output_dir: Output directory for analysis results
            
        Returns:
            Analysis result dictionary
        """
        print(f"[Step 1] Analyzing PDF: {pdf_path}")
        
        # Run the analyzer
        result = analyze_ppt_pdf(
            pdf_path=pdf_path,
            output_dir=output_dir,
            verbose=True,
            classification_method="dual"
        )
        
        print(f"✓ PDF analysis complete")
        return result
    
    def copy_report_to_analyzed(self, output_dir: str) -> str:
        """
        Step 2: Copy final_report.json to analyzed_text.json
        
        Args:
            output_dir: Directory containing the analysis results
            
        Returns:
            Path to the analyzed_text.json file
        """
        print(f"\n[Step 2] Copying final_report.json to analyzed_text.json")
        
        # Find the analysis output directory
        if output_dir is None:
            # Default output directory pattern from text_analyzer.py
            output_dir = Path("example_analysis")
        else:
            output_dir = Path(output_dir)
        
        # Source and destination paths
        source_path = output_dir / "final_report.json"
        dest_path = Path("analyzed_text.json")
        
        if not source_path.exists():
            raise FileNotFoundError(f"final_report.json not found at {source_path}")
        
        # Copy the file
        shutil.copy2(source_path, dest_path)
        print(f"✓ Copied {source_path} to {dest_path}")
        
        return str(dest_path)
    
    def load_json_data(self, json_path: str) -> Dict[str, Any]:
        """Load JSON data from file"""
        with open(json_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    def prepare_data_for_stage1(self, json_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Prepare data for Stage 1 reclassification
        
        Args:
            json_data: The analyzed PDF data
            
        Returns:
            List of page data prepared for reclassification
        """
        pages = json_data.get("classified_content", {}).get("pages", [])
        prepared_pages = []
        
        for page in pages:
            # Combine all content for reclassification
            combined_content = []
            combined_content.extend(page.get("title", []))
            combined_content.extend(page.get("body", []))
            combined_content.extend(page.get("others", []))
            
            prepared_pages.append({
                "page_number": page.get("page", 0),
                "title_raw": page.get("title", []),
                "combined_raw_content": combined_content,
                "original_classification_method": page.get("classification_method", {})
            })
        
        return prepared_pages
    
    def stage1_reclassify(self, json_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Stage 1: Reclassification & Restructuring
        
        Args:
            json_data: The analyzed PDF data
            
        Returns:
            Reclassified data
        """
        print(f"\n[Stage 1] Reclassification & Restructuring")
        
        # Prepare the content
        prepared_pages = self.prepare_data_for_stage1(json_data)
        
        # Create the prompt with the prepared data
        prompt_content = f"""다음 페이지들의 내용을 재분류해주세요:

{json.dumps(prepared_pages, ensure_ascii=False, indent=2)}"""
        
        # Create the messages
        messages = [
            SystemMessage(content=self.reclassification_prompt),
            HumanMessage(content=prompt_content)
        ]
        
        # Get response from Gemini
        print("✓ Sending reclassification request to Gemini API...")
        response = self.llm.invoke(messages)
        
        # Parse response
        try:
            # Clean the response content
            response_text = response.content.strip()
            
            # Try to extract JSON from the response
            import re
            # Look for JSON structure
            json_match = re.search(r'\{[\s\S]*\}', response_text)
            if json_match:
                json_str = json_match.group()
                reclassified_data = json.loads(json_str)
            else:
                # If no JSON found, try parsing the whole response
                reclassified_data = json.loads(response_text)
            
            print("✓ Reclassification complete")
            return reclassified_data
            
        except json.JSONDecodeError as e:
            print(f"❌ Failed to parse JSON response: {e}")
            print(f"Response preview: {response_text[:500]}...")
            
            # Create a fallback structure
            fallback_data = {
                "reclassified_pages": []
            }
            
            # Try to salvage what we can from the original data
            for page in prepared_pages:
                fallback_data["reclassified_pages"].append({
                    "page": page["page_number"],
                    "title": " ".join(page["title_raw"]) if page["title_raw"] else "제목 없음",
                    "body": " ".join(page["combined_raw_content"]),
                    "others": [f"page_number: {page['page_number']}"]
                })
            
            print("✓ Using fallback structure")
            return fallback_data
    
    def stage2_augment(self, reclassified_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Stage 2: Content Augmentation - Process each page individually
        
        Args:
            reclassified_data: The reclassified data from stage 1
            
        Returns:
            Augmented data
        """
        print(f"\n[Stage 2] Content Augmentation")
        
        augmented_pages = []
        pages = reclassified_data.get("reclassified_pages", [])
        
        for i, page in enumerate(pages):
            print(f"  Processing page {i+1}/{len(pages)}...")
            
            # Create prompt for individual page
            page_prompt = f"""원본 body 텍스트:
{page.get('body', '')}

위 내용을 보강해주세요. 원본 텍스트를 그대로 유지하면서 각 내용에 대한 상세한 설명을 추가하세요."""
            
            messages = [
                SystemMessage(content=self.augmentation_prompt),
                HumanMessage(content=page_prompt)
            ]
            
            try:
                # Get response for this page
                response = self.llm.invoke(messages)
                augmented_body = response.content.strip()
                
                # Clean up the augmented body - remove any JSON formatting if present
                import re
                # Remove JSON code blocks if they exist
                augmented_body = re.sub(r'```json\s*\{[^}]*"body"\s*:\s*"([^"]*?)"[^}]*\}\s*```', r'\1', augmented_body, flags=re.DOTALL)
                # Remove any remaining code blocks
                augmented_body = re.sub(r'```[^`]*```', '', augmented_body)
                # Clean up any escaped quotes
                augmented_body = augmented_body.replace('\\"', '"')
                augmented_body = augmented_body.replace('\\n', '\n')
                
                # Create augmented page
                augmented_page = {
                    "page": page.get("page", i+1),
                    "title": page.get("title", ""),
                    "body": augmented_body,
                    "others": page.get("others", [])
                }
                augmented_pages.append(augmented_page)
                
            except Exception as e:
                print(f"  ⚠️  Error processing page {i+1}: {e}")
                # Keep original if augmentation fails
                augmented_pages.append(page)
        
        print("✓ Content augmentation complete")
        
        return {
            "pages": augmented_pages
        }
    
    def save_intermediate_results(self, data: Dict[str, Any], filename: str):
        """Save intermediate results"""
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"✓ Saved intermediate results to {filename}")
    
    def run_pipeline(self, 
                    pdf_path: str = "example.pdf",
                    output_dir: str = None,
                    save_intermediate: bool = True) -> Dict[str, Any]:
        """
        Run the complete two-stage pipeline
        
        Args:
            pdf_path: Path to the PDF file
            output_dir: Output directory for analysis results
            save_intermediate: Whether to save intermediate results
            
        Returns:
            Final augmented data
        """
        print("="*60)
        print("Starting Two-Stage LangChain PDF Analysis Pipeline")
        print("="*60)
        
        try:
            # Step 1: Analyze PDF
            analysis_result = self.analyze_pdf(pdf_path, output_dir)
            
            # Determine the actual output directory used
            if output_dir is None:
                output_dir = Path(pdf_path).parent / f"{Path(pdf_path).stem}_analysis"
            
            # Step 2: Copy report
            analyzed_json_path = self.copy_report_to_analyzed(output_dir)
            
            # Load the JSON data
            json_data = self.load_json_data(analyzed_json_path)
            
            # Stage 1: Reclassification
            reclassified_data = self.stage1_reclassify(json_data)
            
            if save_intermediate:
                self.save_intermediate_results(
                    reclassified_data, 
                    "stage1_reclassified.json"
                )
            
            # Stage 2: Augmentation
            augmented_data = self.stage2_augment(reclassified_data)
            
            # Save final results
            self.save_intermediate_results(
                augmented_data,
                "final_augmented_report.json"
            )
            
            print("\n" + "="*60)
            print("Pipeline completed successfully!")
            print("="*60)
            
            return augmented_data
            
        except Exception as e:
            print(f"\n❌ Error in pipeline: {str(e)}")
            raise


def main():
    """Main function to run the pipeline"""
    # Create pipeline instance
    pipeline = PDFAnalysisLangChainPipeline()
    
    # Run the pipeline
    try:
        result = pipeline.run_pipeline(
            pdf_path="example.pdf",
            output_dir=None,  # Will use default
            save_intermediate=True
        )
        
        # Print summary
        print("\n" + "="*60)
        print("Pipeline Summary:")
        print("="*60)
        print(f"Total pages processed: {len(result.get('pages', []))}")
        
        # Show first page as example
        if result.get('pages'):
            first_page = result['pages'][0]
            print(f"\nExample (Page {first_page.get('page', 1)}):")
            print(f"Title: {first_page.get('title', 'N/A')}")
            print(f"Body preview: {first_page.get('body', '')[:200]}...")
        
    except Exception as e:
        print(f"Pipeline failed: {str(e)}")
        return 1
    
    return 0


if __name__ == "__main__":
    exit(main())
