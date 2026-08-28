/** Initializes Sequelize models once and declares their persistence relationships. */
const sequelize = require('../config/database');
const UserFactory = require('./user');
const TemplateFactory = require('./template');
const FavoriteFactory = require('./favorite');
const GenerationHistoryFactory = require('./generationHistory');

const User = UserFactory(sequelize);
const Template = TemplateFactory(sequelize);
const Favorite = FavoriteFactory(sequelize);
const GenerationHistory = GenerationHistoryFactory(sequelize);

// Favorite is modeled explicitly because API code also reads and deletes join records directly.
User.belongsToMany(Template, { through: Favorite, as: 'FavoriteTemplates' });
Template.belongsToMany(User, { through: Favorite, as: 'TemplateFans' });

User.hasMany(Favorite, { foreignKey: 'UserId' });
Favorite.belongsTo(User, { foreignKey: 'UserId' });
Template.hasMany(Favorite, { foreignKey: 'TemplateId' });
Favorite.belongsTo(Template, { foreignKey: 'TemplateId' });

// History retains its user owner and may outlive a removed catalog template.
User.hasMany(GenerationHistory, { foreignKey: 'UserId' });
GenerationHistory.belongsTo(User, { foreignKey: 'UserId' });
Template.hasMany(GenerationHistory, { foreignKey: 'TemplateId' });
GenerationHistory.belongsTo(Template, { foreignKey: 'TemplateId' });

module.exports = {
  sequelize,
  User,
  Template,
  Favorite,
  GenerationHistory
};
