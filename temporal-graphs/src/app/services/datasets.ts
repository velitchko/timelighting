import * as vandebunte from '../../assets/vandebunt.json';
import * as rugby from '../../assets/rugby.json';
import * as newcomb from '../../assets/newcomb.json';
import * as dialogs from '../../assets/pride.json';
import * as infovis from '../../assets/infovis.json';


export const DATASETS: any = {
    vandebunte: {
        src: vandebunte,
        label: 'vandebunte',
        displayName: 'Vandebunte'
    },
    rugby: {
        src: rugby,
        label: 'rugby',
        displayName: 'Rugby'
    },
    newcomb: {
        src: newcomb,
        label: 'newcomb',
        displayName: 'Newcomb'
    },
    dialogs: {
        src: dialogs,
        label: 'dialogs', 
        displayName: 'Dialogs'
    },
    infovis: {
        src: infovis,
        label: 'infovis',
        displayName: 'Infovis'
    }
};