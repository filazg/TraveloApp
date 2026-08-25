import { Button, Grid, Typography } from "@mui/material";
import CreditCardIcon from "@mui/icons-material/CreditCard";
import EuroIcon from "@mui/icons-material/Euro";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import { useDispatch, useSelector } from "react-redux";
import { allAppData, setStateData } from "../../store/appSlice";


export default function OptionsBar() {
    const dispatch = useDispatch();
    const appData = useSelector(allAppData);
    const buyer = appData.saleData?.selectedBuyer;
    const hasBuyer = !!buyer?.buyer_vat_id;

    const handleSelectPayment = (e, params) => {
        dispatch(setStateData({ path: "saleData/selectedPaymentMethod", value: params }));
    };

    const handleOpenAddressBook = () => {
        dispatch(setStateData({ path: "modalsStates/showAddressBookModal", value: true }));
    };
    return(
        <>
      <Grid
        sx={{
          width: "100%",
        }}
      >
        <Grid
          item
          sx={{
            p: 1,
            fontSize: "0,875rem",
            fontWeight: "700",
          }}
        >
          <Grid
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(1, 1fr)",
              gap: 1,
              gridTemplateRows: "auto",
              gridTemplateAreas: `"one"
                        "two"
                        "tree"`,
            }}
          >
            <Button
              variant="contained"
              color={hasBuyer ? "success" : "primary"}
              startIcon={<ReceiptLongIcon />}
              sx={{
                // Ista visina i font kao ostali gumbi u stupcu; razmak dolazi iz
                // gap-a mreže, pa mb više ne treba — prije se zbrajao i to
                // nejednako (2 ovdje, 1 na načinima plaćanja).
                gridArea: "one",
                height: 88,
                flexDirection: "column",
                lineHeight: 1.2,
                fontSize: "1.1rem",
              }}
              onClick={handleOpenAddressBook}
            >
              {/* F2 se vidi na samom gumbu — blagajnik inače nema gdje provjeriti
                  hoće li račun izaći na papir ili otići kupcu kao e-račun. */}
              {hasBuyer && buyer.f2_required ? "R1 / F2" : "R1 RAČUN"}
              {hasBuyer && (
                <Typography variant="caption" sx={{ mt: 0.5, fontWeight: 600 }}>
                  {(buyer.buyer_company_name || buyer.buyer_name || "").slice(0, 22)}
                </Typography>
              )}
            </Button>
            <>
            {appData.basicData.payment_methods.map((payment) => (
              <Button
                key={payment.id}
                variant="contained"
                color={
                  appData.saleData?.selectedPaymentMethod?.uuid ===
                  payment.uuid
                    ? "success"
                    : "primary"
                }
                sx={{
                  height: 88,
                  width: "100%",
                  fontSize: "1.1rem",
                }}
                onClick={(e) => handleSelectPayment(e, payment)}
                startIcon={
                  payment.payment_type_acr === "K" ? (
                    <CreditCardIcon />
                  ) : (
                    <EuroIcon />
                  )
                }
              >
                {payment.name}
              </Button>
            ))}
            </>
            <Button
              variant="contained"
              color="error"
              sx={{
                gridArea: "tree",
                height: 100,
                display: "none",
              }}
              //onClick={handleTruncateData}
            >
              TRUNCATE DATA
            </Button>
          </Grid>
        </Grid>
      </Grid>
    </>
    )
}