import { Box, Typography } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { boatSliceData, setBoatData } from "../../boatSlice";
import { useDispatch, useSelector } from "react-redux";


export default function AddTimetableRoutesSummaryDrawer(){
    const dispatch = useDispatch()
    const boatData = useSelector(boatSliceData)

    const rows = boatData?.newData?.departuresForTimetable || []
    const boats = boatData?.boatData?.boats || []

    // Plovilo se bira na prethodnom koraku i upisuje se u svaki redak. Ovdje se
    // može promijeniti za pojedini polazak — uz plovilo se mijenjaju i kapaciteti,
    // jer se oni vode po retku, ne po plovidbenom redu.
    const applyBoatToRow = (row, boatUuid) => {
        const boat = boats.find((b) => b.uuid === boatUuid)
        if (!boat) return { ...row, boat_uuid: boatUuid }
        return {
            ...row,
            boat_uuid: boat.uuid,
            capacity: boat.capacity,
            vip_capacity: boat.vip_capacity,
            pets_capacity: boat.pets_capacity,
            bicycle_capacity: boat.bicycle_capacity,
        }
    }

    const processRowUpdate = (newRow, oldRow) => {
        const updated = newRow.boat_uuid !== oldRow.boat_uuid
            ? applyBoatToRow(newRow, newRow.boat_uuid)
            : newRow
        dispatch(setBoatData({
            path: "newData/departuresForTimetable",
            value: rows.map((r) => (r.id === updated.id ? updated : r)),
        }))
        return updated
    }

    const columns = [
      { field: "departure_harbor_name", headerName: "luka od", flex: 3, editable: true },
      {
        field: "departure_harbor_id",
        headerName: "luka od šifra",
        flex: 3,
        editable: true,
      },
      { field: "arrival_harbor_name", headerName: "luka do", flex: 3, editable: true },
      { field: "arrival_harbor_id", headerName: "luka do šifra", flex: 3, editable: true },
      {
        field: "departure",
        headerName: "polazak",
        flex: 3,
        editable: true,
      },
      { field: "arrival", headerName: "dolazak", flex: 3, editable: true },
      { field: "direction", headerName: "smjer", flex: 3, editable: true },
      { field: "sequence", headerName: "redoslijed", flex: 3, editable: true },
      { field: "harbor_order", headerName: "redoslijed", flex: 3, editable: true },
      {
        field: "boat_uuid",
        headerName: "plovilo",
        flex: 3,
        editable: true,
        type: "singleSelect",
        valueOptions: boats.map((b) => ({ value: b.uuid, label: b.name })),
      },
      { field: "capacity", headerName: "kapacitet", flex: 2 },
    ];

    return(
    <>
        <Box
                  sx={{
                    mt: 2,
                    ml: 2,
                    width: "98%",
                    overflowX: "auto"
                  }}
                >
                  <>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
                      Plovilo je preuzeto s prethodnog koraka — dvoklik na ćeliju „plovilo" mijenja ga samo za taj polazak.
                    </Typography>
                    <Box
                      sx={{
                        height:"75vh",
                        minWidth: 1200
                    }}
                    >
                      <DataGrid
                        rows={rows}
                        columns={columns}
                        processRowUpdate={processRowUpdate}
                        onProcessRowUpdateError={(err) => console.error(err)}
                      />
                    </Box>
                  </>
                </Box>
    </>
    )
}
