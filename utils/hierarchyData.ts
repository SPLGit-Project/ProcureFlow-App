export interface HierarchyStructure {
    [pool: string]: {
        [catalog: string]: {
             [type: string]: {
                 [category: string]: string[] // SubCategories
             }
        }
    }
}

export const MASTER_HIERARCHY: HierarchyStructure = {
  "Administrative": {
    "Accommodation": {
      "Charges & Fees": {
        "Surcharge": [
          "Delivery",
          "Late",
          "Packing",
          "Pickup",
          "Service"
        ]
      }
    },
    "Health Care": {
      "Charges & Fees": {
        "Surcharge": [
          "Delivery",
          "Rental",
          "Supply"
        ]
      }
    },
    "Linen Hub": {
      "Charges & Fees": {
        "Mat": ["Bath"],
        "Towel": ["Bath", "Face Washer", "Hand"]
      }
    },
    "Mining": {
      "Charges & Fees": {
        "Surcharge": ["Delivery", "Handling"]
      }
    }
  },

  "COG": {
    "Accommodation": {
      "Bath Linen": {
        "Cloth": ["Face Washer"],
        "Curtains & Drapes": ["Shower"],
        "Mat": ["Bath"],
        "Robe": ["Bath"],
        "Rug": ["Bath"],
        "Sheet": ["Bath"],
        "Towel": ["Bath", "Face", "Face Washer", "Hand", "Pool"]
      },
      "Bed Linen": {
        "Bedspread": ["Custom"],
        "Blanket": ["COG", "Custom"],
        "Cover": ["Cushion", "Ironing Board"],
        "Doonas & Quilts": ["Cover", "Insert"],
        "Pillow Case": ["Custom", "Standard"],
        "Protector": ["Doona / Quilt", "Mattress", "Pillow", "Pillow Case"],
        "Rags": ["COG"],
        "Rug": ["Knee"],
        "Runner": ["Bed"],
        "Sheet": ["Custom", "Double", "Flat", "Single", "Standard", "Top"],
        "Topper": ["Mattress"]
      },
      "Hospital Wear": {
        "Robe": ["Bath"]
      },
      "Mats": {
        "Mats": ["Bath"]
      },
      "Table Linen": {
        "Napkin": ["Serviette"]
      },
      "Work Wear": {
        "Clothing-Top": ["Shirt"]
      }
    },

    "Food & Beverages": {
      "Cleaning": {
        "Mop": ["Head"]
      },
      "Kitchen Linen": {
        "Cover": ["Chair"]
      },
      "Kitchen Wear": {
        "Apron": ["Custom"]
      },
      "Table Linen": {
        "Napkin": ["Serviette"],
        "Table Linen": ["Custom", "Trestle"]
      }
    },

    "Health Care": {
      "Bath Linen": {
        "Curtains & Drapes": ["Custom", "Fensitrated", "Shower"],
        "Mat": ["Floor"],
        "Towel": ["Face Washer", "Hand"]
      },
      "Bed Linen": {
        "Bedspread": ["Custom"],
        "Blanket": ["COG"],
        "Doonas & Quilts": ["Cover", "Insert"],
        "Pillow Case": ["Custom"],
        "Protector": ["Kylie", "Mattress"],
        "Sheet": ["Cot", "Custom", "Fitted", "Slide", "Standard"],
        "Sling": ["Custom", "Patient"]
      },
      "Cleaning": {
        "Duster": ["High", "Microfibre"],
        "Mop": ["Head", "String"]
      },
      "Hospital Wear": {
        "Apparel": ["T-Shirt"],
        "Baby": ["Feeder", "Gown", "Wrap"],
        "Clothing-Baby": ["Bodysuit"],
        "Clothing-Top": ["Adults"],
        "Gown": ["Patient"],
        "Hand Wear": ["Gloves-Heat Resistant"],
        "Hood": ["Counter"],
        "Robe": ["Bath"],
        "Scrubs-Bottom": ["Pants"],
        "Scrubs-Top": ["Top"],
        "Sling": ["Loop"]
      },
      "Kitchen Linen": {
        "Towel": ["Tea"]
      },
      "Kitchen Wear": {
        "Hand Wear": ["Oven Mitt"]
      }
    },

    "Linen Hub": {
      "Bed Linen": {
        "Sheet": ["Custom"]
      }
    },

    "Mining": {
      "Bath Linen": {
        "Curtains & Drapes": ["Custom", "Shower"],
        "Mat": ["Bath"],
        "Sheet": ["Bath"],
        "Towel": ["Bath", "Face Washer", "Gym", "Hand"]
      },
      "Bed Linen": {
        "Blanket": ["COG"],
        "Doonas & Quilts": ["Comforter", "Cover", "Insert"],
        "Pillow Case": ["Custom"],
        "Protector": ["Mattress", "Pillow Case"],
        "Sheet": ["Custom", "Fitted", "Flat"]
      },
      "Work Wear": {
        "Clothing-Top": ["Overalls"]
      }
    },

    "Theater": {
      "Surgeon Items": {
        "Gown": ["Surgeon"]
      }
    }
  },

  "Logistics": {
    "Transport": {
      "Delivery": {
        "Inserts & Liners": ["Bin Liner", "Sheet"],
        "Linen Bags": ["Bag", "Reject", "Safety", "Soiled", "Standard", "Zip"],
        "Trolleys & Tubs": ["Cage", "Full", "Reject", "Rental", "Soiled"]
      }
    }
  },

  "Rental": {
    "Accommodation": {
      "Bed Linen": {
        "Sheet": ["Flat"]
      }
    },
    "Linen Hub": {
      "Bath Linen": {
        "Towel": ["Bath"]
      },
      "Bed Linen": {
        "Blanket": ["Cellular", "Fibresmart"]
      },
      "Charges & Fees": {
        "Doonas & Quilts": ["Cover"]
      },
      "Cleaning": {
        "Mop": ["Head"]
      },
      "Theatre": {
        "Scrubs-Bottom": ["Pants"],
        "Scrubs-Top": ["Jacket", "Top"]
      }
    }
  }
};
