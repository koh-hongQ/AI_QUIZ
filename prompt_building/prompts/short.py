from schemas import ShortPromptConfig
import random
import time

def generate_short_prompt(topic: str, config: ShortPromptConfig) -> str:
    """
    Generates a structured Short Answer prompt.
    """
    # 랜덤 시드
    random_seed = int(time.time() * 1000) % 100000

    # Few-shot 예시 추가
    example_prompt = """
    Example:
    {
        "question": "What is the largest planet in our solar system?",
        "correct_answer": "Jupiter"
    }
    """

    return f"""
    You are a quiz generator.
    Generate a {config.difficulty}-level short-answer question about '{topic}'.
    Limit the answer to {config.word_limit} words.

    Requirements:
    - Avoid repetition and generate unique questions each time.
    - Use diverse phrasing and sentence structure.
    - The question should not be identical to previous generations.
    - Use the random seed: {random_seed} for entropy and randomness.

    Respond ONLY with this JSON structure:
    {example_prompt}

    Constraints:
    - Only respond with the JSON object, no explanations.
    - Ensure the answer is brief and concise.
    - Do not include any text before or after the JSON object.
    """