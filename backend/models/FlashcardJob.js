const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');
const User = require('./User');

/**
 * Génération d'une collection de flashcards, exécutée côté serveur.
 *
 * L'utilisateur lance la génération puis peut fermer l'application : le travail
 * se poursuit dans une invocation Lambda séparée et l'état est suivi ici. À son
 * retour, l'interface retrouve le job par son identifiant ; une notification
 * push l'avertit dès que la collection est prête.
 */
const FlashcardJob = sequelize.define(
  'flashcard_job',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'user', key: 'id' },
      onDelete: 'CASCADE',
    },
    subject: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    /**
     * Nature du travail :
     *   deck     — création d'une collection entière ;
     *   cards    — lot de cartes ajouté à une collection existante ;
     *   single   — carte à l'unité, dont les propositions sont validées à la main ;
     *   complete — chaque groupe existant est étoffé à partir de son propre thème.
     * Les deux premiers écrivent leurs cartes eux-mêmes ; le troisième dépose
     * ses propositions dans `proposals` et attend l'accord de l'utilisateur.
     */
    mode: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'deck',
    },
    card_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 30,
    },
    level: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'intermediaire',
    },
    language: {
      type: DataTypes.STRING(40),
      allowNull: false,
      defaultValue: 'français',
    },
    // queued → running → ready | error | canceled
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'queued',
    },
    /** Libellé de l'étape en cours, affiché tel quel dans l'interface. */
    step: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    progress: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    /** Renseigné dès que le plan a abouti : les cartes y sont ajoutées au fil de l'eau. */
    deck_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    /**
     * Destination des cartes dans la collection :
     *   auto  — groupes déduits du plan, créés au passage (comportement d'origine) ;
     *   none  — aucune carte n'est rangée dans un groupe ;
     *   fixed — toutes les cartes vont dans `chapter_id`.
     */
    chapter_mode: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: 'auto',
    },
    /** Groupe de destination, quand `chapter_mode` vaut 'fixed'. */
    chapter_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    /**
     * Consigne facultative du mode « compléter », qui vient affiner la demande
     * sans remplacer le sujet d'origine de la collection. Elle vit à part de
     * `subject` justement pour que celui-ci reste le sujet de la collection.
     */
    refine_prompt: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    groups_total: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    groups_done: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    cards_created: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    /** Doublons écartés, cartes reformulées, groupes en échec… */
    stats: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    /** Identifiants des fichiers joints servant de source (voir modèle Upload). */
    upload_ids: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    /**
     * Cartes proposées par le mode « carte à l'unité », en attente de validation.
     * Elles vivent ici et non dans `flashcard` : l'utilisateur écarte celles qui
     * ne l'intéressent pas avant que quoi que ce soit ne rejoigne sa collection.
     * Forme : [{ term, front, back, hint }]
     */
    proposals: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    error: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    finished_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: 'flashcard_job',
    freezeTableName: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [{ fields: ['user_id', 'status'] }],
  }
);

FlashcardJob.belongsTo(User, { foreignKey: 'user_id' });

/** Statuts pour lesquels plus rien ne bougera. */
FlashcardJob.TERMINAL_STATUSES = ['ready', 'error', 'canceled'];

module.exports = FlashcardJob;
