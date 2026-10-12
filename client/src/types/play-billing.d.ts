interface Window {
  getDigitalGoodsService?: (serviceProvider: string) => Promise<unknown>;
  AndroidPlayBilling?: {
    queryCatalog: (requestJson: string) => void;
    launchPurchase: (requestJson: string) => void;
    syncPurchases: (requestJson: string) => void;
  };
}
