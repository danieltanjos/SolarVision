package br.com.solarvision.api.controller;

import br.com.solarvision.api.dto.CleaningDtos;
import br.com.solarvision.api.service.CleaningService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
public class CleaningController {

    private final CleaningService cleaningService;

    public CleaningController(CleaningService cleaningService) {
        this.cleaningService = cleaningService;
    }

    @GetMapping("/panels/{panelId}/cleanings")
    public List<CleaningDtos.CleaningResponse> listByPanel(@PathVariable Long panelId) {
        return cleaningService.listByPanel(panelId);
    }

    @PostMapping("/cleanings")
    public CleaningDtos.CleaningResponse create(@Valid @RequestBody CleaningDtos.CleaningRequest request) {
        return cleaningService.create(request);
    }

    @PatchMapping("/cleanings/{cleaningId}")
    public CleaningDtos.CleaningResponse update(@PathVariable Long cleaningId,
                                                @Valid @RequestBody CleaningDtos.CleaningRequest request) {
        return cleaningService.update(cleaningId, request);
    }

    @DeleteMapping("/cleanings/{cleaningId}")
    public CleaningDtos.CleaningDeleteResponse delete(@PathVariable Long cleaningId) {
        return cleaningService.delete(cleaningId);
    }
}
