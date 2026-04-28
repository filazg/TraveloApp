import { Box } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { boatSliceData } from "../../boatSlice";
import { useSelector } from "react-redux";


export default function AddTimetableRoutesSummaryDrawer(){
    const boatData = useSelector(boatSliceData)
    
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
                        height:"75vh",
                        minWidth: 1200
                    }}
                    >
                      <DataGrid
                        rows={boatData?.newData?.departuresForTimetable || []}
                        columns={columns}
                        //onCellClick={(params) => setSelectedRow(params.row)}
                        //getRowId={(row) => row.id}
                        //onCellEditStart={(params) => setRowId(params.id)}
                        //slots={{ toolbar: CustomToolbar }}
                      />
                    </Box>
                  </>
                </Box>
    </>
    )
}