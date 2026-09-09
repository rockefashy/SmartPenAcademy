import { Type, FunctionDeclaration } from '@google/genai';
import { AgentTool, AgentToolContext, AgentToolResult } from './types.ts';
import { landingProperties } from '../../src/properties/landing.properties.ts';

export const getCurriculumDeclaration: FunctionDeclaration = {
  name: 'getCurriculum',
  description: 'Get comprehensive details on SmartPen Academy curriculum, the 7 progressive training modules, print & cursive scripts, exam speed boosters, and specialized holiday workshops.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      topic: {
        type: Type.STRING,
        description: 'Optional focus: "modules", "workshops", "benefits", or "all". Default is "all".'
      }
    }
  }
};

export const getCurriculumTool: AgentTool = {
  name: 'getCurriculum',
  declaration: getCurriculumDeclaration,
  rateLimit: { maxCalls: 60, windowMs: 60 * 1000 },
  async execute(args: any, _context: AgentToolContext): Promise<AgentToolResult> {
    const syllabus = landingProperties.syllabusSection;
    const workshops = landingProperties.adsAndWorkshopsSection.workshops;
    const benefits = landingProperties.benefitsSection.cards;

    const topic = (args?.topic || 'all').toLowerCase();

    let summary = `📚 **SmartPen Academy Curriculum Blueprint**\n*${syllabus.title} — ${syllabus.subtitle}*\n\n`;

    if (topic === 'workshops' || topic === 'all') {
      summary += `### Specialized Bootcamps & Intensives:\n`;
      workshops.forEach(w => {
        summary += `• **${w.title}** [${w.badge}]: ${w.subtitle} (${w.duration}, ${w.ageGroup})\n  - Highlights: ${w.highlights.join('; ')}\n`;
      });
      summary += `\n`;
    }

    if (topic === 'modules' || topic === 'all') {
      summary += `### 7 Progressive Training Modules:\n`;
      syllabus.modules.forEach(m => {
        summary += `• **Module ${m.number}: ${m.title}**\n  - ${m.items.join('\n  - ')}\n`;
      });
      summary += `\n`;
    }

    if (topic === 'benefits' || topic === 'all') {
      summary += `### Core Student Outcomes:\n`;
      benefits.forEach(b => {
        summary += `• **${b.title}** [${b.badge}]: ${b.description}\n`;
      });
      summary += `\n`;
    }

    summary += `✨ *${syllabus.footerBanner}*\n\n💡 *Tip: You can book a free demo class to get your child's writing assessed before enrolling!*`;

    return {
      result: { modules: syllabus.modules, workshops, benefits },
      summary,
      success: true
    };
  }
};
