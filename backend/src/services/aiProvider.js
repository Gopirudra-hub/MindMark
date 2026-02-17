import axios from 'axios';
import { logger } from '../index.js';

const AI_PROVIDER = process.env.AI_PROVIDER || 'local';
const AI_BASE_URL = process.env.AI_BASE_URL || 'http://localhost:11434';
const CLOUD_API_KEY = process.env.CLOUD_API_KEY || '';
const CLOUD_API_URL = process.env.CLOUD_API_URL || 'https://api.openai.com/v1';

/**
 * AI Provider abstraction layer
 * Switches between local Ollama and cloud API based on environment variable
 */

async function callLocalOllama(prompt, model = 'llama2:7b') {
    try {
        const response = await axios.post(`${AI_BASE_URL}/api/generate`, {
            model,
            prompt,
            stream: false,
            options: {
                temperature: 0.7,
                num_predict: 2048
            }
        }, {
            timeout: 120000
        });

        return response.data.response;
    } catch (error) {
        logger.error('Ollama API error:', error.message);
        throw new Error(`Local AI error: ${error.message}`);
    }
}

async function callCloudAPI(prompt, model = 'gpt-3.5-turbo') {
    try {
        const response = await axios.post(`${CLOUD_API_URL}/chat/completions`, {
            model,
            messages: [
                { role: 'system', content: 'You are a helpful assistant that generates educational content.' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 2048
        }, {
            headers: {
                'Authorization': `Bearer ${CLOUD_API_KEY}`,
                'Content-Type': 'application/json'
            },
            timeout: 30000
        });

        return response.data.choices[0].message.content;
    } catch (error) {
        logger.error('Cloud API error:', error.message);
        throw new Error(`Cloud AI error: ${error.message}`);
    }
}

async function generateContent(prompt) {
    if (AI_PROVIDER === 'local') {
        return callLocalOllama(prompt);
    } else {
        return callCloudAPI(prompt);
    }
}

/**
 * Generate a short summary of the content
 */
export async function generateSummary(text) {
    const truncatedText = text.substring(0, 10000);

    const prompt = `Summarize the following content in 2-3 concise paragraphs. Focus on the main ideas and key takeaways:

${truncatedText}

Summary:`;

    return generateContent(prompt);
}

/**
 * Generate a detailed summary of the content
 */
export async function generateDetailedSummary(text) {
    const truncatedText = text.substring(0, 10000);

    const prompt = `Provide a detailed summary of the following content. Include all major topics, subtopics, and important details. Structure it with clear sections:

${truncatedText}

Detailed Summary:`;

    return generateContent(prompt);
}

/**
 * Extract key concepts from the content
 */
export async function generateKeyConcepts(text) {
    const truncatedText = text.substring(0, 10000);

    const prompt = `Extract the key concepts and terms from the following content. List each concept with a brief explanation:

${truncatedText}

Key Concepts (format as JSON array with "concept" and "explanation" fields):`;

    const response = await generateContent(prompt);

    try {
        // Try to parse as JSON
        const jsonMatch = response.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        return response;
    } catch {
        return response;
    }
}

/**
 * Generate multiple choice questions
 */
export async function generateMCQs(summary, count = 5) {
    const prompt = `Based on the following summary, generate ${count} multiple choice questions to test understanding. Each question should have 4 options (A, B, C, D) with one correct answer.

Summary:
${summary}

Generate questions in the following JSON format:
[
  {
    "questionText": "Question text here?",
    "type": "mcq",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswer": "Option A",
    "explanation": "Brief explanation of why this is correct",
    "difficulty": "easy|medium|hard"
  }
]

Questions:`;

    const response = await generateContent(prompt);

    try {
        const jsonMatch = response.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        throw new Error('Failed to parse MCQ response');
    } catch (error) {
        logger.error('Failed to parse MCQ response:', error.message);
        throw new Error('Failed to generate MCQs');
    }
}

/**
 * Generate short answer questions
 */
export async function generateShortAnswerQuestions(summary, count = 3) {
    const prompt = `Based on the following summary, generate ${count} short answer questions that test comprehension and critical thinking.

Summary:
${summary}

Generate questions in the following JSON format:
[
  {
    "questionText": "Question text here?",
    "type": "short",
    "correctAnswer": "Expected answer or key points to include",
    "explanation": "What makes a good answer",
    "difficulty": "easy|medium|hard"
  }
]

Questions:`;

    const response = await generateContent(prompt);

    try {
        const jsonMatch = response.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        throw new Error('Failed to parse short answer response');
    } catch (error) {
        logger.error('Failed to parse short answer response:', error.message);
        throw new Error('Failed to generate short answer questions');
    }
}

/**
 * Generate scenario-based questions
 */
export async function generateScenarioQuestions(summary, count = 2) {
    const prompt = `Based on the following summary, generate ${count} scenario-based questions that test application of knowledge in real-world situations.

Summary:
${summary}

Generate questions in the following JSON format:
[
  {
    "questionText": "Scenario description... What would you do?",
    "type": "scenario",
    "correctAnswer": "Expected approach or answer",
    "explanation": "Why this approach is correct",
    "difficulty": "medium|hard"
  }
]

Questions:`;

    const response = await generateContent(prompt);

    try {
        const jsonMatch = response.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        throw new Error('Failed to parse scenario response');
    } catch (error) {
        logger.error('Failed to parse scenario response:', error.message);
        throw new Error('Failed to generate scenario questions');
    }
}

/**
 * Generate flashcards
 */
export async function generateFlashcards(summary, count = 5) {
    const prompt = `Based on the following summary, generate ${count} flashcards for memorization and quick review.

Summary:
${summary}

Generate flashcards in the following JSON format:
[
  {
    "questionText": "Front of card (term or question)",
    "type": "flashcard",
    "correctAnswer": "Back of card (definition or answer)",
    "difficulty": "easy|medium|hard"
  }
]

Flashcards:`;

    const response = await generateContent(prompt);

    try {
        const jsonMatch = response.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        throw new Error('Failed to parse flashcard response');
    } catch (error) {
        logger.error('Failed to parse flashcard response:', error.message);
        throw new Error('Failed to generate flashcards');
    }
}

/**
 * Generate all question types at once
 */
export async function generateAllQuestions(summary) {
    const [mcqs, shortAnswers, scenarios, flashcards] = await Promise.all([
        generateMCQs(summary, 5),
        generateShortAnswerQuestions(summary, 3),
        generateScenarioQuestions(summary, 2),
        generateFlashcards(summary, 5)
    ]);

    return {
        mcqs,
        shortAnswers,
        scenarios,
        flashcards,
        total: mcqs.length + shortAnswers.length + scenarios.length + flashcards.length
    };
}

export default {
    generateSummary,
    generateDetailedSummary,
    generateKeyConcepts,
    generateMCQs,
    generateShortAnswerQuestions,
    generateScenarioQuestions,
    generateFlashcards,
    generateAllQuestions
};
