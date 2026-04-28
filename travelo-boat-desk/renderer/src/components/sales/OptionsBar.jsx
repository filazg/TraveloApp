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
          width: 178,
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
                gridArea: "one",
                height: 100,
                mb: 2,
                flexDirection: "column",
                lineHeight: 1.2,
              }}
              onClick={handleOpenAddressBook}
            >
              R1 RAČUN
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
                  height: 80,
                  mb: 1,
                  width: "100%",
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