// test.js - Handle evaluation generation with 4 different LLM prompts

class TranscriptEvaluator {
    constructor() {
        this.apiEndpoint = '/api/evaluate';  // Adjust this to match your backend endpoint
        this.isGenerating = false;
    }

    /**
     * Main method to trigger evaluation
     */
    async generateEvaluation(transcript) {
        if (this.isGenerating) {
            console.log('Evaluation already in progress...');
            return;
        }

        if (!transcript || transcript.trim() === '') {
            alert('Please enter a transcript to evaluate.');
            return;
        }

        this.isGenerating = true;
        this.updateButtonState(true);

        try {
            // Execute all 4 prompts in parallel for efficiency
            const [executiveSummary, rubricScores, recommendations, suggestedReply] = await Promise.all([
                this.getExecutiveSummary(transcript),
                this.getRubricScores(transcript),
                this.getRecommendations(transcript),
                this.getSuggestedReply(transcript)
            ]);

            // Display all results
            this.displayResults({
                executiveSummary,
                rubricScores,
                recommendations,
                suggestedReply
            });

        } catch (error) {
            console.error('Error generating evaluation:', error);
            alert('An error occurred while generating the evaluation. Please try again.');
        } finally {
            this.isGenerating = false;
            this.updateButtonState(false);
        }
    }

    /**
     * Prompt 1: Generate Executive Summary
     */
    async getExecutiveSummary(transcript) {
        const prompt = `
You are an expert evaluator analyzing a transcript between a helper/counselor and a person seeking help.

Analyze the following transcript and provide an executive summary with these three components:

1. Overall Level: Rate the conversation quality (Excellent/Good/Fair/Needs Improvement)
2. Strengths: Identify 1-2 key strengths demonstrated in the conversation
3. Priorities: Identify 1-2 priority areas for improvement

Transcript:
${transcript}

Provide your response in the following JSON format:
{
    "overallLevel": "string",
    "strengths": "string",
    "priorities": "string"
}`;

        return await this.callLLM(prompt, 'executive-summary');
    }

    /**
     * Prompt 2: Generate Rubric Scores
     */
    async getRubricScores(transcript) {
        const prompt = `
You are an expert evaluator analyzing a transcript between a helper/counselor and a person seeking help.

Evaluate the following transcript across these 7 dimensions on a scale of 1-4:

1. Rapport & Safety: Building trust and creating a safe space
2. Emotional Validation: Acknowledging and validating feelings
3. Clarification: Asking questions to understand the situation better
4. Issue Framing: Helping frame the problem clearly
5. Options: Exploring different possibilities and choices
6. Empowerment: Encouraging autonomy and self-efficacy
7. Next Steps: Establishing concrete action items

For each dimension, provide:
- A score from 1-4 (1=Poor, 2=Fair, 3=Good, 4=Excellent)
- A brief justification (1-2 sentences)

Transcript:
${transcript}

Provide your response in the following JSON format:
{
    "rubrics": [
        {
            "name": "Rapport & Safety",
            "score": 0,
            "justification": "string"
        },
        {
            "name": "Emotional Validation",
            "score": 0,
            "justification": "string"
        },
        {
            "name": "Clarification",
            "score": 0,
            "justification": "string"
        },
        {
            "name": "Issue Framing",
            "score": 0,
            "justification": "string"
        },
        {
            "name": "Options",
            "score": 0,
            "justification": "string"
        },
        {
            "name": "Empowerment",
            "score": 0,
            "justification": "string"
        },
        {
            "name": "Next Steps",
            "score": 0,
            "justification": "string"
        }
    ]
}`;

        return await this.callLLM(prompt, 'rubric-scores');
    }

    /**
     * Prompt 3: Generate Recommendations
     */
    async getRecommendations(transcript) {
        const prompt = `
You are an expert evaluator analyzing a transcript between a helper/counselor and a person seeking help.

Based on the following transcript, provide 3-5 specific, actionable recommendations for how the helper could improve their approach in future conversations.

Each recommendation should:
- Be specific and actionable
- Focus on concrete behaviors or techniques
- Be relevant to the conversation context

Transcript:
${transcript}

Provide your response in the following JSON format:
{
    "recommendations": [
        "Recommendation 1",
        "Recommendation 2",
        "Recommendation 3"
    ]
}`;

        return await this.callLLM(prompt, 'recommendations');
    }

    /**
     * Prompt 4: Generate Suggested Reply
     */
    async getSuggestedReply(transcript) {
        const prompt = `
You are an expert counselor/helper providing guidance.

Based on the following transcript, generate a suggested next reply that the helper could use to continue the conversation effectively.

The suggested reply should:
- Demonstrate empathy and emotional validation
- Ask clarifying questions if needed
- Offer support or guidance as appropriate
- Be natural and conversational (2-4 sentences)
- Build on what was already discussed

Transcript:
${transcript}

Provide your response in the following JSON format:
{
    "suggestedReply": "string"
}`;

        return await this.callLLM(prompt, 'suggested-reply');
    }

    /**
     * Call LLM API with the given prompt
     */
    async callLLM(prompt, requestType) {
        try {
            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    prompt: prompt,
                    requestType: requestType,
                    temperature: 0.7,
                    maxTokens: 1000
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            // Parse JSON response from LLM
            try {
                return JSON.parse(data.response || data.content || data.message);
            } catch (e) {
                console.warn('Failed to parse LLM response as JSON, returning raw response:', e);
                return { raw: data.response || data.content || data.message };
            }

        } catch (error) {
            console.error(`Error calling LLM for ${requestType}:`, error);
            throw error;
        }
    }

    /**
     * Display all evaluation results in the UI
     */
    displayResults(results) {
        // Display Executive Summary
        this.displayExecutiveSummary(results.executiveSummary);

        // Display Rubric Scores
        this.displayRubricScores(results.rubricScores);

        // Display Recommendations
        this.displayRecommendations(results.recommendations);

        // Display Suggested Reply
        this.displaySuggestedReply(results.suggestedReply);
    }

    /**
     * Display Executive Summary
     */
    displayExecutiveSummary(summary) {
        const container = document.querySelector('.eval-section:nth-of-type(1)');
        if (!container) return;

        const overallLevel = summary.overallLevel || 'N/A';
        const strengths = summary.strengths || 'No strengths identified';
        const priorities = summary.priorities || 'No priorities identified';

        container.innerHTML = `
            <h3>Executive Summary</h3>
            <p style="color: #333; font-style: normal; margin: 8px 0; line-height: 1.6; font-size: 14px;"><b>Overall Level:</b> ${this.escapeHtml(overallLevel)}</p>
            <p style="color: #333; font-style: normal; margin: 8px 0; line-height: 1.6; font-size: 14px;"><b>Strengths:</b> ${this.escapeHtml(strengths)}</p>
            <p style="color: #333; font-style: normal; margin: 8px 0; line-height: 1.6; font-size: 14px;"><b>Priorities:</b> ${this.escapeHtml(priorities)}</p>
        `;
    }

    /**
     * Display Rubric Scores
     */
    displayRubricScores(scores) {
        const container = document.querySelector('.eval-section:nth-of-type(3)');
        if (!container) return;

        const rubrics = scores.rubrics || [];
        
        let html = '<h3>Rubric Scores</h3>';
        
        rubrics.forEach(rubric => {
            const score = rubric.score || 0;
            const maxScore = 4;
            const percentage = (score / maxScore) * 100;
            const progressClass = this.getProgressClass(percentage);

            html += `
                <div class="rubric-item">
                    <div class="rubric-header">
                        <span class="rubric-name">${this.escapeHtml(rubric.name)}</span>
                        <span class="rubric-score">${score}/${maxScore}</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill ${progressClass}" style="width: ${percentage}%;"></div>
                    </div>
                    ${rubric.justification ? `<p style="margin-top: 8px; font-size: 13px; color: #666;">${this.escapeHtml(rubric.justification)}</p>` : ''}
                </div>
            `;
        });

        container.innerHTML = html;
    }

    /**
     * Display Recommendations
     */
    displayRecommendations(recommendations) {
        const container = document.querySelector('.eval-section:nth-of-type(2)');
        if (!container) return;

        const items = recommendations.recommendations || [];
        
        let html = '<h3>Recommendations</h3>';
        
        items.forEach(item => {
            html += `<p style="color: #333; font-style: normal; margin: 8px 0; line-height: 1.6; font-size: 14px;">• ${this.escapeHtml(item)}</p>`;
        });

        container.innerHTML = html;
    }

    /**
     * Display Suggested Reply
     */
    displaySuggestedReply(reply) {
        const textarea = document.querySelector('.suggestion-input');
        if (!textarea) return;

        const suggestedText = reply.suggestedReply || 'No suggestion available';
        textarea.value = suggestedText;
        // Remove placeholder attribute and ensure normal styling
        textarea.removeAttribute('placeholder');
        textarea.style.color = '#333';
        textarea.style.fontStyle = 'normal';
    }

    /**
     * Get progress bar color class based on percentage
     */
    getProgressClass(percentage) {
        if (percentage <= 37.5) return 'low';      // 1.5/4 or less
        if (percentage <= 62.5) return 'medium';   // 2.5/4 or less
        return 'high';                              // 3/4 or more
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Update button state during generation
     */
    updateButtonState(isGenerating) {
        const button = document.querySelector('.generate-btn');
        if (!button) return;

        if (isGenerating) {
            button.disabled = true;
            button.textContent = '⏳ Generating...';
            button.style.opacity = '0.6';
            button.style.cursor = 'not-allowed';
        } else {
            button.disabled = false;
            button.textContent = '✨ Generate Evaluation';
            button.style.opacity = '1';
            button.style.cursor = 'pointer';
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    const evaluator = new TranscriptEvaluator();
    const generateBtn = document.querySelector('.generate-btn');
    const transcriptInput = document.querySelector('.transcript-input');

    if (generateBtn && transcriptInput) {
        generateBtn.addEventListener('click', function() {
            const transcript = transcriptInput.value;
            evaluator.generateEvaluation(transcript);
        });
    }
});
