from schemas import OXPromptConfig
import random
import time # 랜덤 시드

def generate_ox_prompt(topic: str, config: OXPromptConfig) -> str:
    """
    Generates a structured OX prompt with enhanced randomness.
    """

    random_seed = int(time.time() * 1000) % 100000
    is_true = random.choice([True, False])
    correct_answer = "O" if is_true else "X"

    # Few-shot 예시 추가
    example_prompt = """
    Example:
    {
        "question": "Is the Earth round?",
        "options": [
            {"option_text": "O", "is_correct": true},
            {"option_text": "X", "is_correct": false}
        ],
        "correct_answer": "O"
    }
    """

    return f"""
    You are a quiz generator. Generate a {config.difficulty}-level True/False (OX) question about '{topic}'.

    Requirements:
    - The question should be unique and avoid repetition.
    - Use diverse phrasing and sentence structure for each generation.
    - Avoid reusing past questions and create novel expressions.
    - Use the random seed: {random_seed} for entropy and randomness.

    Respond ONLY with this JSON structure:
    {example_prompt}

    Constraints:
    - Only respond with the JSON object, no explanations.
    - Ensure the correct answer matches the label provided.
    - Do not include any text before or after the JSON object.
    """