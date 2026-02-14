'use strict';

const categories = {
  'Guest Post': ['Data-driven angle', 'Beginner guide swap', 'Case study contribution', 'Industry trends commentary', 'Evergreen update pitch'],
  'Broken Link': ['Resource replacement', 'Dead stat replacement', 'Tutorial fix', 'Tools page repair', 'Research page repair'],
  'Link Reclamation': ['Unlinked mention request', 'Image credit link', 'Founder quote attribution', 'Product mention reclaim', 'Campaign mention reclaim'],
  Skyscraper: ['Expanded guide outreach', 'Updated statistics outreach', 'Visual asset outreach', 'Checklist upgrade outreach', 'Expert roundup outreach'],
  'Podcast Pitch': ['Founder interview pitch', 'Tactical framework pitch', 'Case study pitch', 'Trend prediction pitch', 'Audience Q&A pitch'],
  Partnership: ['Co-marketing proposal', 'Newsletter swap', 'Webinar collaboration', 'Tool integration announcement', 'Affiliate partnership'],
  'Influencer Collab': ['Creator feature pitch', 'Joint live session', 'Review collaboration', 'Giveaway collaboration', 'UGC campaign pitch'],
  'PR Mention': ['Commentary contribution', 'Data quote pitch', 'Rapid response expert quote', 'Product launch mention', 'Award announcement mention']
};

const requiredFields = [
  'firstName',
  'siteName',
  'siteUrl',
  'topic',
  'articleUrl',
  'yourUrl',
  'offerAngle',
  'specificCompliment',
  'goal',
  'tone',
  'length'
];

function buildTemplate(category, variant) {
  return {
    name: `${category} - ${variant}`,
    category,
    subjectTemplate: '{firstName}, quick idea for {siteName} on {topic}',
    bodyTemplate: `Hi {firstName},\n\nI was reading {articleUrl} on {siteName} and loved this: {specificCompliment}.\n\nI noticed an opportunity around {topic}. I can contribute a ${variant.toLowerCase()} with a ${'{offerAngle}'} angle that supports your ${'{goal}'} objective.\n\nIf useful, we can reference ${'{yourUrl}'} and tailor tone as ${'{tone}'} with a ${'{length}'} format.\n\nOpen to a quick yes/no this week?\n\nBest,\nYour Name`,
    requiredFields: JSON.stringify(requiredFields),
    followUp1SubjectTemplate: 'Following up: {topic} idea for {siteName}',
    followUp1BodyTemplate: 'Hi {firstName},\n\nQuick follow-up in case this got buried. Happy to share a draft based on {offerAngle} and keep it {tone}.\n\nBest,\nYour Name',
    followUp2SubjectTemplate: 'Final check-in on {topic}',
    followUp2BodyTemplate: 'Hi {firstName},\n\nLast nudge from me. If helpful, I can send a short version and examples from {yourUrl}.\n\nThanks for considering it.\nYour Name'
  };
}

module.exports = {
  async up(queryInterface) {
    const now = new Date();

    const templates = Object.entries(categories).flatMap(([category, variants]) =>
      variants.map((variant) => ({
        ...buildTemplate(category, variant),
        createdAt: now,
        updatedAt: now
      }))
    );

    await queryInterface.bulkInsert('Templates', templates, {});
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('Templates', null, {});
  }
};
