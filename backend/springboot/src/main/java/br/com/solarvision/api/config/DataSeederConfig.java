package br.com.solarvision.api.config;

import br.com.solarvision.api.domain.entity.Alert;
import br.com.solarvision.api.domain.entity.AppUser;
import br.com.solarvision.api.domain.entity.Cleaning;
import br.com.solarvision.api.domain.entity.Panel;
import br.com.solarvision.api.domain.entity.PanelReading;
import br.com.solarvision.api.domain.entity.SolarGroup;
import br.com.solarvision.api.domain.enums.AlertSeverity;
import br.com.solarvision.api.domain.enums.GroupStatus;
import br.com.solarvision.api.domain.enums.PanelStatus;
import br.com.solarvision.api.domain.enums.UserRole;
import br.com.solarvision.api.repository.AlertRepository;
import br.com.solarvision.api.repository.AppUserRepository;
import br.com.solarvision.api.repository.CleaningRepository;
import br.com.solarvision.api.repository.PanelReadingRepository;
import br.com.solarvision.api.repository.PanelRepository;
import br.com.solarvision.api.repository.SolarGroupRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.OffsetDateTime;
import java.util.List;

@Configuration
public class DataSeederConfig {

    @Bean
    CommandLineRunner seed(AppUserRepository appUserRepository,
                           SolarGroupRepository solarGroupRepository,
                           PanelRepository panelRepository,
                           CleaningRepository cleaningRepository,
                           AlertRepository alertRepository,
                           PanelReadingRepository panelReadingRepository) {
        return args -> {
            if (solarGroupRepository.count() > 0) {
                return;
            }

            AppUser user = new AppUser();
            user.setName("Admin SolarVision");
            user.setEmail("admin@solarvision.com");
            user.setRole(UserRole.ADMIN);
            user.setGoogleSubject("seed-admin");
            appUserRepository.save(user);

            SolarGroup group = new SolarGroup();
            group.setName("Usina Norte");
            group.setLocation("Florianópolis/SC");
            group.setStatus(GroupStatus.ACTIVE);
            solarGroupRepository.save(group);

            Panel panel1 = new Panel();
            panel1.setSolarGroup(group);
            panel1.setSerialNumber("SV-PNL-001");
            panel1.setModel("Mono 550W");
            panel1.setStatus(PanelStatus.ACTIVE);
            panelRepository.save(panel1);

            Panel panel2 = new Panel();
            panel2.setSolarGroup(group);
            panel2.setSerialNumber("SV-PNL-002");
            panel2.setModel("Mono 550W");
            panel2.setStatus(PanelStatus.DIRTY);
            panelRepository.save(panel2);

            Cleaning cleaning = new Cleaning();
            cleaning.setPanel(panel2);
            cleaning.setPerformedAt(OffsetDateTime.now().minusDays(1));
            cleaning.setWaterUsedLiters(18.5);
            cleaning.setPerformedBy("Equipe Operacional");
            cleaning.setNotes("Limpeza preventiva realizada.");
            cleaningRepository.save(cleaning);

            Alert alert = new Alert();
            alert.setPanel(panel2);
            alert.setType("SOILING");
            alert.setSeverity(AlertSeverity.HIGH);
            alert.setSoilingIndex(0.72);
            alert.setActive(true);
            alertRepository.save(alert);

            List<Panel> panels = List.of(panel1, panel2);
            for (int i = 0; i < 15; i++) {
                for (Panel panel : panels) {
                    PanelReading reading = new PanelReading();
                    reading.setPanel(panel);
                    reading.setTimestamp(OffsetDateTime.now().minusDays(14 - i));
                    reading.setGenerationKw(12.5 + i + (panel.getId() % 2));
                    reading.setSoilingIndex(panel.getStatus() == PanelStatus.DIRTY ? 0.55 + (i * 0.01) : 0.18 + (i * 0.005));
                    reading.setWaterReuseLiters(20.0 + i);
                    reading.setEfficiency(panel.getStatus() == PanelStatus.DIRTY ? 79.0 - (i * 0.3) : 92.0 - (i * 0.1));
                    panelReadingRepository.save(reading);
                }
            }
        };
    }
}
