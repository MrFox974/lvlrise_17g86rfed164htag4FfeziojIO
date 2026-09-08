const Test = require('../models/Test')
const { Op } = require('sequelize')

exports.getAllTests = async (req, res) => {
    try {
        console.log('Début de getAllTests')
        
        const tests = await Test.findAll({
            where: {
                id: {
                    [Op.between]: [1, 10]
                    
                }
            },
            order: [['id', 'ASC']]
        })


        console.log(`Nombre d'enregistrements trouvés: ${tests.length}`)

        res.json({ tests })
    } catch (error) {
        console.error('Erreur lors de la récupération des tests:', error)
        res.status(500).json({ error: 'Erreur serveur', details: error.message })
    }
}

