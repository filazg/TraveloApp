const { DataTypes } = require("sequelize");

module.exports =  (sequelize) =>{
    const TimetablesModel = sequelize.define(
    "timetables",
    {
        id:{
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        uuid:{
            type: DataTypes.STRING,
            allowNull: false
        },
        code:{
            type: DataTypes.STRING,
            allowNull: false
        },
        name:{
            type: DataTypes.STRING,
            allowNull: false
        },
        line_uuid:{
            type: DataTypes.STRING,
            allowNull: false
        },
        line_code:{
            type: DataTypes.STRING,
            allowNull: true
        },
        line_name:{
            type: DataTypes.STRING,
            allowNull: true
        },
        updated_by_uuid:{
            type: DataTypes.STRING,
            allowNull: true
        },
        updated_by_username:{
            type: DataTypes.STRING,
            allowNull: true
        },
        // Slobodna napomena uz plovidbeni red — nije obavezna. Sluzi ljudima
        // koji rade s redovima (npr. "vrijedi samo dok traje remont"), pa se
        // vidi u pregledu.
        note:{
            type: DataTypes.TEXT,
            allowNull: true
        },
        // Cijena vrijedi jednako u oba smjera (Split–Hvar kao i Hvar–Split).
        // Tada se u portalu unosi jednom, a suprotni smjer dobiva istu cijenu
        // pri spremanju — prodaja i dalje trazi cijenu po smjeru, pa u bazi
        // moraju stajati oba zapisa.
        same_price_both_ways:{
            type: DataTypes.BOOLEAN,
            allowNull: true,
            defaultValue: false
        },
        is_active:{
            type: DataTypes.BOOLEAN,
            allowNull:false
        }
    },{
        freezeTableName:true, tableName: "timetables", timestamps: true
    }
    );
    return{
        TimetablesModel
    }
}


