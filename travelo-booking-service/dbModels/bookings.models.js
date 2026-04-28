const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
    // One row per (departure_uuid, route_uuid, category_uuid) — per leg per capacity category.
    const BookingModel = sequelize.define(
        "bookings",
        {
            id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
            booking_uuid: { type: DataTypes.STRING, allowNull: false, unique: true },

            // Voyage (whole sailing from first → last harbor)
            departure_uuid: { type: DataTypes.STRING, allowNull: false },
            timetable_uuid: { type: DataTypes.STRING, allowNull: false },
            sequence: { type: DataTypes.INTEGER, allowNull: false },
            departure_date: { type: DataTypes.STRING, allowNull: true },
            boat_uuid: { type: DataTypes.STRING, allowNull: true },
            line_code: { type: DataTypes.STRING, allowNull: true },
            line_name: { type: DataTypes.STRING, allowNull: true },

            // Leg
            route_uuid: { type: DataTypes.STRING, allowNull: false },
            departure_harbor_id: { type: DataTypes.STRING, allowNull: true },
            departure_harbor_name: { type: DataTypes.STRING, allowNull: true },
            departure_harbor_order: { type: DataTypes.INTEGER, allowNull: true },
            arrival_harbor_id: { type: DataTypes.STRING, allowNull: true },
            arrival_harbor_name: { type: DataTypes.STRING, allowNull: true },
            arrival_harbor_order: { type: DataTypes.INTEGER, allowNull: true },

            // Category
            category_uuid: { type: DataTypes.STRING, allowNull: false },
            category_code: { type: DataTypes.STRING, allowNull: true },

            // Capacity (snapshot from boat/voyage at init)
            capacity_base: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
            capacity_additional: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },

            // Counters
            in_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
            out_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
            occupied: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
            validated: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },

            is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
        },
        { freezeTableName: true, tableName: "bookings", timestamps: true }
    );
    return { BookingModel };
};
