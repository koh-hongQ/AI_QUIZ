from typing import List, Dict, Optional, Union, Literal
from dataclasses import dataclass, asdict
from openai import OpenAI
import json
import re

from ..config import config
from ..logger import logger
from .vector_search import SearchResult
from .text_processor import TextChunk


@dataclass
class Question:
    """Base question class"""
    id: str
    type: str
    question: str
    metadata: Optional[Dict] = None


@dataclass
class MCQQuestion(Question):
    """Multiple choice question"""
    type: str = "mcq"
    options: List[str] = None
    correct_answer: int = None
    explanation: Optional[str] = None


@dataclass
class TrueFalseQuestion(Question):
    """True/False question"""
    type: str = "truefalse"
    correct_answer: bool = None
    explanation: Optional[str] = None


@dataclass
class EssayQuestion(Question):
    """Essay question"""
    type: str = "essay"
    sample_answer: Optional[str] = None
    evaluation_criteria: Optional[List[str]] = None


@dataclass
class Quiz:
    """Quiz containing multiple questions"""
    id: str
    title: str
    document_id: str
    document_name: str
    quiz_type: str
    questions: List[Union[MCQQuestion, TrueFalseQuestion, EssayQuestion]]
    total_questions: int
    estimated_time: int  # in minutes
    difficulty_level: str
    created_at: str
    metadata: Optional[Dict] = None


class QuizGenerator:
    """Service for generating quizzes using LLM"""
    
    QuizType = Literal["mcq", "truefalse", "essay", "mixed"]
    
    def __init__(self):
        self.openai_client = OpenAI(api_key=config.OPENAI_API_KEY)
        logger.info("QuizGenerator initialized")
    
    async def generate_quiz_from_chunks(self,
                                      document_id: str,
                                      document_name: str,
                                      chunks: List[SearchResult],
                                      quiz_type: QuizType,
                                      question_count: int = 5,
                                      custom_query: Optional[str] = None) -> Quiz:
        """
        Generate a quiz from relevant chunks
        
        Args:
            document_id: Document identifier
            document_name: Original document name
            chunks: Relevant chunks found by search
            quiz_type: Type of quiz to generate
            question_count: Number of questions to generate
            custom_query: Optional custom query context
            
        Returns:
            Generated Quiz object
        """
        try:
            logger.info(f"Generating {quiz_type} quiz with {question_count} questions")
            
            # Combine chunk content
            context = self._prepare_context(chunks)
            
            # Generate questions based on type
            if quiz_type == "mixed":
                questions = await self._generate_mixed_questions(context, question_count, custom_query)
            else:
                questions = await self._generate_questions_by_type(context, quiz_type, question_count, custom_query)
            
            # Create quiz
            quiz = Quiz(
                id=f"quiz_{document_id}_{int(time.time())}",
                title=self._generate_quiz_title(document_name, quiz_type, custom_query),
                document_id=document_id,
                document_name=document_name,
                quiz_type=quiz_type,
                questions=questions,
                total_questions=len(questions),
                estimated_time=self._estimate_completion_time(questions),
                difficulty_level=self._estimate_difficulty(questions),
                created_at=datetime.now().isoformat(),
                metadata={
                    'custom_query': custom_query,
                    'chunks_used': len(chunks),
                    'source_pages': list(set(chunk.chunk.page_number for chunk in chunks if chunk.chunk.page_number))
                }
            )
            
            logger.info(f"Quiz generated successfully with {len(questions)} questions")
            return quiz
            
        except Exception as e:
            logger.error(f"Error generating quiz: {str(e)}")
            raise
    
    def _prepare_context(self, chunks: List[SearchResult]) -> str:
        """Prepare context from chunks for question generation"""
        context_parts = []
        
        for i, chunk in enumerate(chunks):
            content = chunk.chunk.content
            page_info = f" (Page {chunk.chunk.page_number})" if chunk.chunk.page_number else ""
            
            context_parts.append(f"""
Section {i+1}{page_info}:
{content}
""")
        
        return "\n".join(context_parts)
    
    async def _generate_mixed_questions(self, context: str, total_count: int, custom_query: Optional[str] = None) -> List[Question]:
        """Generate a mix of different question types"""
        # Distribute question types
        mcq_count = total_count // 3
        tf_count = total_count // 3
        essay_count = total_count - mcq_count - tf_count
        
        questions = []
        
        # Generate MCQ questions
        if mcq_count > 0:
            mcq_questions = await self._generate_questions_by_type(context, "mcq", mcq_count, custom_query)
            questions.extend(mcq_questions)
        
        # Generate True/False questions
        if tf_count > 0:
            tf_questions = await self._generate_questions_by_type(context, "truefalse", tf_count, custom_query)
            questions.extend(tf_questions)
        
        # Generate Essay questions
        if essay_count > 0:
            essay_questions = await self._generate_questions_by_type(context, "essay", essay_count, custom_query)
            questions.extend(essay_questions)
        
        return questions
    
    async def _generate_questions_by_type(self, context: str, quiz_type: str, count: int, custom_query: Optional[str] = None) -> List[Question]:
        """Generate questions of a specific type"""
        try:
            prompt = self._create_generation_prompt(context, quiz_type, count, custom_query)
            
            response = await self.openai_client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": self._get_system_prompt(quiz_type)},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=2000,
                temperature=0.7
            )
            
            # Parse response
            response_text = response.choices[0].message.content
            questions = self._parse_questions(response_text, quiz_type)
            
            return questions
            
        except Exception as e:
            logger.error(f"Error generating {quiz_type} questions: {str(e)}")
            raise
    
    def _create_generation_prompt(self, context: str, quiz_type: str, count: int, custom_query: Optional[str] = None) -> str:
        """Create prompt for question generation"""
        base_prompt = f"""
Based on the following context, generate {count} {quiz_type} questions:

Context:
{context}
"""
        
        if custom_query:
            base_prompt += f"""
Focus on: {custom_query}
"""
        
        if quiz_type == "mcq":
            base_prompt += """
For each multiple-choice question, provide:
1. A clear question
2. Four plausible options (A, B, C, D)
3. The correct answer (A, B, C, or D)
4. A brief explanation

Format as JSON:
[
  {
    "question": "Question text?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct_answer": 0,
    "explanation": "Explanation text"
  }
]
"""
        elif quiz_type == "truefalse":
            base_prompt += """
For each true/false question, provide:
1. A clear statement
2. Whether it's true or false
3. A brief explanation

Format as JSON:
[
  {
    "question": "Statement to evaluate",
    "correct_answer": true,
    "explanation": "Explanation text"
  }
]
"""
        elif quiz_type == "essay":
            base_prompt += """
For each essay question, provide:
1. A thought-provoking question that requires analysis
2. A sample answer or key points
3. Evaluation criteria

Format as JSON:
[
  {
    "question": "Essay question?",
    "sample_answer": "Sample answer or key points",
    "evaluation_criteria": ["Criterion 1", "Criterion 2", "Criterion 3"]
  }
]
"""
        
        return base_prompt
    
    def _get_system_prompt(self, quiz_type: str) -> str:
        """Get system prompt for different question types"""
        base_prompt = "You are an expert educational assessment creator. Generate high-quality, pedagogically sound questions that test understanding, not just memorization."
        
        type_specific = {
            "mcq": " Create multiple-choice questions with plausible distractors that test conceptual understanding.",
            "truefalse": " Create true/false questions that test important concepts without being trivial.",
            "essay": " Create essay questions that require critical thinking and synthesis of concepts.",
            "mixed": " Create a variety of question types appropriate for the content."
        }
        
        return base_prompt + type_specific.get(quiz_type, "")
    
    def _parse_questions(self, response_text: str, quiz_type: str) -> List[Question]:
        """Parse LLM response into Question objects"""
        try:
            # Extract JSON from response
            json_match = re.search(r'\[.*\]', response_text, re.DOTALL)
            if not json_match:
                raise ValueError("No JSON found in response")
            
            json_str = json_match.group(0)
            questions_data = json.loads(json_str)
            
            questions = []
            for i, q_data in enumerate(questions_data):
                question_id = f"q{i+1}"
                
                if quiz_type == "mcq":
                    question = MCQQuestion(
                        id=question_id,
                        question=q_data['question'],
                        options=q_data['options'],
                        correct_answer=q_data['correct_answer'],
                        explanation=q_data.get('explanation', '')
                    )
                elif quiz_type == "truefalse":
                    question = TrueFalseQuestion(
                        id=question_id,
                        question=q_data['question'],
                        correct_answer=q_data['correct_answer'],
                        explanation=q_data.get('explanation', '')
                    )
                elif quiz_type == "essay":
                    question = EssayQuestion(
                        id=question_id,
                        question=q_data['question'],
                        sample_answer=q_data.get('sample_answer', ''),
                        evaluation_criteria=q_data.get('evaluation_criteria', [])
                    )
                
                questions.append(question)
            
            return questions
            
        except Exception as e:
            logger.error(f"Error parsing questions: {str(e)}")
            # Return empty list or raise exception
            raise
    
    def _generate_quiz_title(self, document_name: str, quiz_type: str, custom_query: Optional[str] = None) -> str:
        """Generate a title for the quiz"""
        base_name = document_name.replace('.pdf', '').replace('_', ' ').title()
        
        type_map = {
            "mcq": "Multiple Choice Quiz",
            "truefalse": "True/False Quiz",
            "essay": "Essay Questions",
            "mixed": "Mixed Quiz"
        }
        
        quiz_type_name = type_map.get(quiz_type, "Quiz")
        
        if custom_query:
            return f"{quiz_type_name} on {custom_query} - {base_name}"
        else:
            return f"{quiz_type_name} - {base_name}"
    
    def _estimate_completion_time(self, questions: List[Question]) -> int:
        """Estimate completion time in minutes"""
        time_map = {
            "mcq": 2,  # 2 minutes per MCQ
            "truefalse": 1,  # 1 minute per T/F
            "essay": 10  # 10 minutes per essay
        }
        
        total_time = 0
        for question in questions:
            total_time += time_map.get(question.type, 3)
        
        return max(5, total_time)  # Minimum 5 minutes
    
    def _estimate_difficulty(self, questions: List[Question]) -> str:
        """Estimate quiz difficulty level"""
        essay_count = sum(1 for q in questions if q.type == "essay")
        total_count = len(questions)
        
        if essay_count / total_count > 0.5:
            return "Hard"
        elif essay_count / total_count > 0.3:
            return "Medium"
        else:
            return "Easy"


# Global generator instance
quiz_generator = QuizGenerator()
