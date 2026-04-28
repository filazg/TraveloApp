import { Box } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { boatSliceData } from "../../boatSlice";
import { useDispatch, useSelector } from "react-redux";
import { useEffect } from "react";
import { setAuthData } from "../../../auth/authSlice";


export default function EditTimetableRouteSummaryDrawer({rowsDepartures, setRowsDepartures}){
    const dispatch = useDispatch()
    const boatData = useSelector(boatSliceData)
    const departures = boatData?.boatData?.timetable_details?.departures ?? [];
    useEffect(() => {
      setRowsDepartures(departures);
    }, [departures]);
    
    const columns = [
      { field: "voyage_id", headerName: "broj vožnje", flex: 3, editable: true },
      { field: "departure_harbor_name", headerName: "luka od", flex: 3 },
      {
        field: "departure_harbor_id",
        headerName: "luka od šifra",
        flex: 3,
        editable: true,
      },
      { field: "arrival_harbor_name", headerName: "luka do", flex: 3 },
      { field: "arrival_harbor_id", headerName: "luka do šifra", flex: 3 },
      {
        field: "departure",
        headerName: "polazak",
        flex: 3,
        editable: true,
      },
      { field: "arrival", headerName: "dolazak", flex: 3 },
      { field: "direction", headerName: "smjer", flex: 3 },
      { field: "sequence", headerName: "redoslijed", flex: 3 },
      { field: "harbor_order", headerName: "redoslijed", flex: 3 },
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
                    <Box
                      sx={{
                        height:"62vh",
                        minWidth: 1200
                    }}
                    >
                      <DataGrid
                        rows={rowsDepartures}
                        columns={columns}
                        processRowUpdate={(newRow) => {
                          setRowsDepartures((prev) =>
                            prev.map((r) => (r.id === newRow.id ? newRow : r))
                          );
                          return newRow;
                        }}
                        onProcessRowUpdateError={(err) => console.error(err)}
                      />
                    </Box>
                  </>
                </Box>
    </>
    )
}