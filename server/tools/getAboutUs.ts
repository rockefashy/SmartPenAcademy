import { Type, FunctionDeclaration } from '@google/genai';
import { AgentTool, AgentToolContext, AgentToolResult } from './types.ts';
import { landingProperties } from '../../src/properties/landing.properties.ts';

export const getAboutUsDeclaration: FunctionDeclaration = {
  name: 'getAboutUs',
  description: 'Get details about SmartPen Academy, its founder Mrs. Deepthy Rock, coaching methodology, ISO certification, location, online classes, and direct contact coordinates (8861751000).',
  parameters: {
    type: Type.OBJECT,
    properties: {}
  }
};

export const getAboutUsTool: AgentTool = {
  name: 'getAboutUs',
  declaration: getAboutUsDeclaration,
  rateLimit: { maxCalls: 60, windowMs: 60 * 1000 },
  async execute(_args: any, _context: AgentToolContext): Promise<AgentToolResult> {
    const founder = landingProperties.founderSection;
    const hero = landingProperties.hero;
    const footer = landingProperties.footer;

    let summary = `✍️ **About SmartPen Academy**\n\n`;
    summary += `**${founder.title}**\n*${founder.subtitle}*\n\n`;
    summary += founder.bio.join('\n\n') + '\n\n';
    summary += `> "${founder.quote}"\n> — *${founder.signature}*\n\n`;
    summary += `### Academy Key Highlights:\n`;
    hero.stats.forEach(st => {
      summary += `• **${st.number}** ${st.label} (${st.highlight})\n`;
    });
    summary += `\n• **Core Pillars**: ${hero.featuresPill.join(' • ')}\n`;
    summary += `• **Coaching Formats**: In-Person (Bangalore Center) & Interactive Online Classes Worldwide\n`;
    summary += `• **Direct Phone & WhatsApp**: **8861751000**\n`;
    summary += `• **Standard Fee**: ₹1,600 per 8-class cycle (GPAY UPI to 8861751000)\n`;
    summary += `\n${footer.legal}`;

    return {
      result: { founder, stats: hero.stats },
      summary,
      success: true
    };
  }
};
