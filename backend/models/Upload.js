const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');
const User = require('./User');

/**
 * Fichier envoyé par l'utilisateur (photo, PDF, texte) servant de source à une
 * génération.
 *
 * Le fichier lui-même vit dans S3 ; cette table garde ses métadonnées et le
 * texte qui en a été extrait — c'est ce texte, et non le fichier, qui est
 * envoyé au modèle.
 *
 * Rétention : 7 jours. Deux mécanismes concourants, volontairement redondants :
 * une règle de cycle de vie S3 supprime l'objet côté stockage, et le cron des
 * notifications purge les lignes expirées côté base. Ni l'un ni l'autre ne
 * dépend de l'application pour s'exécuter.
 */
const Upload = sequelize.define(
  'upload',
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
    /** Clé de l'objet dans le bucket. */
    storage_key: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    filename: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    mime_type: {
      type: DataTypes.STRING(120),
      allowNull: false,
    },
    size_bytes: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    // pending  : URL signée délivrée, fichier pas encore déposé
    // ready    : fichier déposé et texte extrait
    // error    : extraction impossible (format illisible, fichier vide…)
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'pending',
    },
    /** Texte extrait du document : c'est lui qui alimente les générateurs. */
    extracted_text: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    /**
     * Ce que contient `extracted_text` :
     *   text        — le texte du document, mot à mot ;
     *   description — la description d'une image qui ne portait pas de texte
     *                 (photo d'un objet, d'une scène, d'une œuvre).
     * La distinction est transmise au modèle : une description n'a pas la même
     * valeur de preuve qu'une transcription, et le prompt doit le savoir.
     */
    content_kind: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'text',
    },
    extracted_chars: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    error: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    tableName: 'upload',
    freezeTableName: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['user_id'] },
      { fields: ['expires_at'] },
    ],
  }
);

Upload.belongsTo(User, { foreignKey: 'user_id' });

/** Durée de conservation des fichiers, en jours. */
Upload.RETENTION_DAYS = 7;

module.exports = Upload;
