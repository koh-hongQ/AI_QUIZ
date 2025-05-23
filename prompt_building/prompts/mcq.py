from schemas import MCQPromptConfig

def generate_mcq_prompt(topic: str, config: MCQPromptConfig) -> str:
    """
    Generates a structured MCQ prompt that instructs the LLM to randomize answer placement.
    """
    
    example_prompt = """
    Example:
    {
        "question": "What is the capital of France?",
        "A": "Berlin",
        "B": "Paris", 
        "C": "Madrid",
        "D": "Rome",
        "correct_answer": "B"
    }
    """

    return f"""You are an expert quiz generator. Create a {config.difficulty}-level multiple-choice question about '{topic}' that requires {config.bloom_level}-level cognitive skills according to Bloom's Taxonomy.

Requirements:
- Generate exactly one clear, unambiguous question
- Create exactly one correct answer and {config.distractor_count} plausible but incorrect distractors
- Randomize the position of the correct answer among options A, B, C, and D
- Ensure distractors are realistic and could plausibly be chosen by someone with partial knowledge
- Make the question appropriate for the specified difficulty level: {config.difficulty}
- Apply {config.bloom_level}-level thinking (e.g., remember, understand, apply, analyze, evaluate, create)

Respond ONLY with this JSON structure:
{example_prompt}

Constraints:
- Output only the JSON object with no additional text, explanations, or formatting
- The correct_answer field must contain exactly one letter: A, B, C, or D
- Ensure the correct_answer corresponds precisely to the option containing the right answer
- All four options (A, B, C, D) must be filled with distinct choices
- The question must be clear, grammatically correct, and unambiguous
- Distractors should be wrong but believable to test real understanding"""